---
name: make-image
description: Generate images by delegating to the Codex CLI's built-in `image_gen` tool (gpt-image-2), which bills against the user's existing ChatGPT Plus/Pro/Team subscription instead of charging the OpenAI API per image. Trigger this skill whenever the user wants to **create / generate / draw / design / produce** any image from a description — icons, illustrations, OGP banners, hero images, logos, headers, thumbnails, mockups, photos, diagrams — even when they don't explicitly say "Codex" or "gpt-image-2". Trigger on phrases like "画像作って", "画像生成して", "アイコン作って", "イラスト作って", "ヘッダー画像", "OGP画像", "サムネ作って", "バナー作って", "ロゴ作って", "make an image", "generate an image", "create an icon", "design a banner", "draw a thumbnail". Skip only when (a) the user explicitly asks for a different image tool (Midjourney, Stable Diffusion local, DALL·E API), or (b) the task is non-generative image work (cropping, resizing, format conversion, compositing) — for those, use ImageMagick / `sips` / Pillow directly.
allowed-tools:
  - Read(*)
  - Agent
  - Bash(codex login status)
  - Bash(codex features list:*)
  - Bash(codex exec --dangerously-bypass-approvals-and-sandbox:*)
  - Bash(ls:*)
  - Bash(mkdir:*)
  - Bash(mv:*)
  - Bash(cp:*)
  - Bash(find:*)
  - Bash(grep:*)
  - Bash(sips:*)
---

# Make Image (via Codex CLI / gpt-image-2)

Delegate image generation to the Codex CLI's built-in `image_gen` tool so
the cost falls on the user's **existing ChatGPT subscription** instead of
billing the OpenAI API per image. Codex runs `gpt-image-2` server-side and
writes the file locally. This skill is the dispatcher — the actual codex
call is offloaded to the **`image-generator` subagent** so the main thread
can keep working while the model takes 30–60 seconds.

## Why delegate to Codex (and not call the OpenAI API directly)

- ChatGPT Plus/Pro/Team subscription covers `image_gen` calls. Direct
  OpenAI API requests bill ~$0.04–$0.40 per image.
- The user has already authenticated `codex` via ChatGPT OAuth on this
  machine.
- Codex handles the model details (sizing, tool routing, file writing).
  This skill only needs to pick a sensible size and write a clear visual
  description.

This **only works in ChatGPT-OAuth mode**. If `codex` is logged in via API
key instead, every generation bills the user — see § Pre-flight.

## Pre-flight (once per session)

```bash
codex login status                            # expect: "Logged in using ChatGPT"
codex features list | grep image_generation   # expect: "stable  true"
```

If `login status` reports API-key mode or unauthenticated, **stop and tell
the user** before generating anything — don't silently fall back to API-key
mode (it would bill them for something they didn't ask for). Recovery:

```bash
codex logout && codex login   # opens the OAuth flow in browser
```

The `image-generator` subagent re-checks this on every invocation and
aborts if auth has flipped, but surfacing the issue conversationally is
faster than discovering it from a failed subagent run.

## Two execution modes

| Mode | Trigger | Pattern |
|---|---|---|
| **Async** (default for AI-driven flows) | The skill is invoked while Claude is also doing other work — composing a doc, finishing a feature, etc. | Spawn `image-generator` with `run_in_background: true`. Continue with other tasks. The completion notification arrives when the image is ready. |
| **Sync** (default for direct user invocation) | The user explicitly typed something like "make an image of …" and is sitting waiting for the result. | Spawn `image-generator` without `run_in_background` (foreground). Block until done, then report the path. |

When in doubt, ask: "is the user actively waiting for this image specifically?"
If yes → sync. If they asked for it as part of a larger flow (e.g.,
"write the README and add a hero image") → async, run in parallel with
the rest of the work.

## Spawning the subagent

Use the `Agent` tool with `subagent_type: "image-generator"`. The input
must follow the subagent's contract:

```
OUT:    <absolute or relative path to .png>
SIZE:   <WIDTHxHEIGHT>     # optional, default 1024x1024
PROMPT:
<one or more lines of visual description>
```

The subagent validates size constraints, runs codex exactly once, locates
the generated image (Codex saves to `~/.codex/generated_images/<session>/`
regardless of the path it's asked to use), and moves it to `OUT`.

## Choosing the size

| Aspect | Size | Use case |
|---|---|---|
| Square 1:1 | `1024x1024` | Icons, profile pics, generic OGP, social cards |
| Landscape 3:2 | `1536x1024` | Hero banners, blog headers |
| Portrait 2:3 | `1024x1536` | Book covers, posters, vertical banners |
| Wide ~16:9 | `1792x1024` | Presentation slides, video thumbnails |

Constraints (the subagent enforces them, but knowing them avoids round-trips):

- Each side a multiple of **16**, max **3840 px**
- Aspect ratio **≤ 3:1**
- Total pixels in **[655,360 – 8,294,400]**

If the user asks for something outside these bounds (e.g., `320x240`
thumbnail, `4096x4096` poster), **propose a valid round-up and ask for
confirmation** before invoking — don't silently rewrite their spec.

> **Note**: gpt-image-2 sometimes returns a slightly different size than
> requested (e.g., 1254×1254 when 1024×1024 was asked). The subagent
> reports both *requested* and *actual* dimensions. If exact pixel
> dimensions matter (e.g., for a CSS background that expects 1024×1024),
> resize the result with `sips -z 1024 1024 <file>` after.

## Writing the prompt

The PROMPT field is passed verbatim into Codex's `image_gen` call. Match
the user's language for the visual description (English for English
conversations, Japanese for Japanese). Be specific about subject,
composition, lighting, palette, and style — vague prompts produce vague
output.

The subagent's internal Codex instruction already tells Codex to use the
built-in tool and avoid scripts/API keys, so this skill's PROMPT field
should focus purely on what the image should look like.

## Workflow

1. **Pre-flight** auth check (first image of the session). Skip on
   subsequent calls within the same session.
2. **Clarify just enough** — only ask for what's missing and consequential:
   filename / output path, target size, transparency need. Don't grill the
   user on style if they didn't constrain it.
3. **Validate the request** — propose round-ups for sub-1024 dimensions;
   warn on transparency requests (see § When NOT to use).
4. **Decide sync vs async** (see § Two execution modes).
5. **Spawn `image-generator`** with the OUT/SIZE/PROMPT block.
6. **For async**: continue with other work. When the completion
   notification arrives, briefly acknowledge to the user that the image
   landed at `<path>`.
7. **For sync**: relay the subagent's saved-path + actual dimensions
   line-for-line.

## When NOT to use this skill (route elsewhere)

- **`codex` is in API-key mode**: ask the user first; it would bill them.
- **Transparent background required** (icons, logos with alpha):
  gpt-image-2 doesn't support alpha. Two options, both with trade-offs:
  1. Generate on a flat background color (white / magenta) and post-process
     with `magick` to remove that color → free but imperfect on
     anti-aliased edges.
  2. Use `gpt-image-1.5` via the OpenAI API → bills per image (~$0.04+).
     Surface this as a paid option; don't auto-execute.
- **Non-generative image work** (crop, resize, format convert, composite,
  watermark): use `sips`, `magick`, or Pillow directly. This skill is for
  from-scratch generation only.
- **User explicitly named another tool** (Midjourney, SD local, Flux, etc.):
  defer to their choice.

## Multi-image / variations

Spawn one subagent per variation, all in the same turn (parallel). Don't
ask Codex for "3 variations in one call" — its `image_gen` tool
sometimes saves only the last image:

```
# Pseudo-code: three Agent calls in one message, each with run_in_background: true
Agent(subagent_type: "image-generator", prompt: "OUT: ./variation-1.png\nSIZE: 1024x1024\nPROMPT: <prompt>")
Agent(subagent_type: "image-generator", prompt: "OUT: ./variation-2.png\nSIZE: 1024x1024\nPROMPT: <prompt>")
Agent(subagent_type: "image-generator", prompt: "OUT: ./variation-3.png\nSIZE: 1024x1024\nPROMPT: <prompt>")
```

Each runs in its own Codex session; the natural randomness produces
different outputs from the same prompt.

## CLI fallback (for direct terminal use)

A standalone bash script lives at `scripts/make-image.sh` for users who
want to invoke generation from a terminal without going through Claude.
It implements the same workflow (validate → run codex → relocate image)
as the subagent. Usage:

```bash
.claude/skills/make-image/scripts/make-image.sh \
  --out ./hero.png \
  --size 1536x1024 \
  --prompt "Aerial view of Tokyo at night, neon on wet asphalt, cinematic"
```

The script is **not** invoked by Claude during skill execution — Claude
always goes through the `image-generator` subagent.

## Output rules

- After the subagent reports back, confirm the path and *both* requested
  and actual dimensions in the reply (the subagent prints both — relay
  them verbatim).
- If the subagent reports "no image saved", treat it as a likely policy
  or safety rejection. Surface that raw to the user — don't auto-soften
  the prompt and re-spawn without their consent.
- For async mode, briefly remind the user when work resumes, e.g.:
  > 画像生成（非同期）を裏で走らせつつ、本文を書き進めます。
  Then on completion: > 画像できました：`./hero.png` （実寸 1536×1024）。
- For multi-image requests, list all saved paths together once all
  subagents complete.
