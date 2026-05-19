---
name: mojiemoji-github
description: Render mojiemoji image stamps (via mojiemoji.jozo.beer) for GitHub markdown — issues, PRs, review comments, replies, release notes. Supports block stamps (own-line headings/callouts/closing lines) and inline mid-sentence emphasis (例 【マジで】やばい【バグ】ですね). On body-class surfaces, pair with shields.io badges.
when_to_use: |
  PROACTIVELY OFFER this skill whenever composing Japanese GitHub markdown — even without mojiemoji keywords. The user strongly prefers expressive stamps over plain text for emotional pivots, status/mood/approval, caution, and punch-line emphasis. Always ask the user once before decorating; never force.

  Auto-trigger on:
  - Composing any Japanese text bound for GitHub (issue body, PR description, review comment, reply, release note)
  - During /make-issue, /make-pr, /address-review, /triage-review, /good-morning replies, or before `gh issue create`, `gh pr create`, `gh pr comment`, `gh pr review`
  - Keywords: mojiemoji, もじえもじ, スタンプ, スタンプ画像, 絵文字, インライン絵文字, GitHub markdown stamp, LGTM stamp
  - User phrases (true invocation only — "I want mojiemoji rendered now"): "絵文字使って", "絵文字いれて", "もじえもじ使って", "スタンプ入れて", "decorate", "emphasize this part", "もっと文中で", "もっと使って"

  Skip when:
  - Body is English-only
  - Surface is Slack, Notion, or generic web (not GitHub)
  - Text is apology / security / legal / compliance / acceptance criteria — clarity over flair
allowed-tools:
  - Read
  - Bash
  - Agent
---

# Mojiemoji Github (Claude)

## Trigger And Scope

Invoke only when the user wants a rendered mojiemoji snippet for a GitHub
surface. Do not invoke for Slack custom emoji, Notion, or generic web pages —
the defaults here target GitHub's sanitizer.

## Pair With Badges (badges are the header)

mojiemoji stamps and shields.io badges are **complementary, not
interchangeable** — badges convey metadata, stamps convey mood. The
recurring failure mode is: stamps get added, badges get forgotten.

**Pairing rule by surface:**

| Surface | Badges | Stamps |
|---|---|---|
| Issue body / PR body / release note | required | optional |
| Review comment / reply | optional (action badge) | primary |
| Issue / PR comment | optional | primary |

**Hard rule: badges are the header. Nothing above them.** On
body-class surfaces (issue body / PR body / release note), the
shields.io badge line is the first thing visually and semantically.
Never place anything above it — including block-mode mojiemoji
stamps (`![alt](...)` on its own line), standalone decoration,
title-like sentences, or image banners. The reviewee's first eye-line
should hit the badges.

The only allowed escape valve: review-comment-style replies that lead
with a single `![action](...)` badge (e.g. `action-fixed-green`). That
is **also** a badge, so the rule still holds — the badge is line 1.

When this skill is invoked for an issue body, PR body, or release
note, **stop and check whether badges are also being added**. If no
badges are present, propose them before (or alongside) the stamps.
See `../../rules/github-markdown.md` § Shields.io Badges
for color conventions and badge selection.

Concrete layout (this entire block is the example body — `## 概要`
is part of the example, not a SKILL.md heading):

````markdown
![type](...) ![scope](...) ![breaking](...) ![diff](...) ![tests](...)

Closes #N.

## 概要

…inline-saturated prose with stamps embedded mid-sentence…
````

## Default Tone & Inline Saturation

When the user does not specify a tone, default by surface:

| Surface | Default tone |
|---|---|
| Issue body / PR body / release note | **loud (inline-saturated)** |
| Review comment / reply | neutral |
| Issue / PR comment | neutral-to-loud (match thread tone) |

Override only when the user says "calm にして", "軽めで", "控えめに",
or the body is in the do-not-stamp categories (apology / security /
legal / compliance / acceptance criteria viewed in isolation). When
in doubt on a body, go loud — the documented failure mode is choosing
neutral and shipping under-decorated prose.

**"Loud" = inline density across every paragraph and bullet**, not
big block stamps. The user's standing preference (no keyword
required, no exception):

- ✅ **Always inline embeds**, substituting words inside prose. Aim
  for generous density — 1–2 per paragraph minimum, more in idea-rich
  bullets. Embed every key noun/verb/adverb that fits grammatically.
- ✗ **Section punch-line decoration** (own-line `→ <stamp1> <stamp2>`
  after each section) — **do not use**. Explicitly rejected as
  「セクション末のブロックスタンプは不要」.
- ✗ **Closing flair** (`---` + own-line mood stamps at body end) —
  **do not use**. Same rejection.
- ✅ **For trailing flair at sentence / paragraph / heading end**, use a
  regular Unicode emoji instead — see
  `../../rules/github-markdown.md` § Trailing decoration.
  Examples: `ようやくマージできた。🎉` / `## デプロイ手順 🚀` /
  `これで仕様の差分は無くなった。✨`. One emoji per slot, never chained.

The user has flagged that own-line block stamps render as
「デカくてよくわからない文節」 and disrupt the body. Mojiemoji = inline
embeds (mid-sentence emphasis); Unicode emoji = trailing flair. Two
slots, two tools — never confuse them.

**Default mode = inline-only on body-class surfaces.** No block
stamps unless the user *explicitly* asks for block decoration in this
turn (e.g. "→ ブロックでつけて" / "盛大に" / "block でも OK"). The
instinct to add a 「次の一手」 heading-style block before a section,
or a 「マージ歓迎」 closing block at the end of a PR body, is exactly
the section-punch-line / closing-flair pattern that has been rejected
multiple times. If the urge surfaces, replace with an inline embed
inside the section's prose.

**Mantra**: 「文中に埋める」「文法崩壊しないように自然に埋め込みまくる」.
Density is high *and* grammar must remain natural — every embed must
read as a clean word substitution, never as an awkward token shoved
between unrelated parts of speech. If a candidate stamp doesn't have
a grammatically natural slot, drop it for that phrase rather than
forcing it.

## Two Modes

| Mode | Surface | Output | Default size |
|---|---|---|---|
| `block` | Own-line stamp in headings, callouts, checklist toppers (NOT closing lines — those use Unicode emoji) | Markdown `![alt](url)` | native |
| `inline` | Mid-sentence emphasis (例: 【マジで】やばい【バグ】) | HTML `<img ... height="24" align="absmiddle">` | 24 px |

GitHub facts to respect:

- Sanitizer strips `style` and ignores CSS units. Use integer pixel `height`.
- `height="24"` reads well at body font size; `height="20"` is the
  user's observed preference. See `references/parameters.md`
  § Inline height.
- Use at most two inline stamps per sentence (relaxes in saturation).

## Embed vs Decoration

Within `inline` mode there are **two sub-patterns** that look identical
in source but read very differently in rendered output. The user has
explicitly flagged this as the #1 readability failure mode:

| Pattern | What | Where it goes | Grammatical role |
|---|---|---|---|
| **Embed** | Stamp replaces a word in the sentence | Inline, in the middle of prose | Substitutes for a noun/verb/adverb that **fits the sentence** |
| **Decoration** | Stamp adds mood/flair without grammatical role | Own line below the prose, prefixed `→ ` | None — purely decorative |

**Rule: never tack a decoration stamp onto the end of a prose sentence.**
Trailing decoration on a sentence (e.g. `…したい <マジで> <大事>。`) blurs
visually with embeds and the reader cannot parse where the sentence
ends. Move trailing decoration to a dedicated line:

```markdown
…したい。

→ <マジで> <大事>
```

Section-heading trailing decoration is OK (headings are visually
distinct from prose), e.g. `## デプロイ順序 <大事>`.

### Embed grammatical safety check

Before inserting an embed, **read the sentence with the stamp's `alt`
text in place**. If it does not parse as natural Japanese, do not embed
— either drop the stamp or move it to a decoration line.

- Bad: `カラムが <グッド> で <存在> する` — `グッド` is a noun-like
  verdict, does not fit the adverbial slot. The sentence is broken.
- Good: `カラムが <存在> する` — `存在` substitutes for the verbal noun
  that already fills the slot.
- Good (fix for the broken case): `カラムが <存在> する。\n\n→ <グッド>`

This rule overrides the saturation-mode default below: even in
saturation mode, embeds must still parse.

### Phrase-length & line-break rules by mode

The mojiemoji service auto-wraps long phrases when they don't fit a
single line at the chosen height. The auto-wrap looks cramped and
illegible — the user has explicitly flagged it as
「絵文字内での改行が悪い」. Two failure modes to avoid, two correct
ways to handle multi-segment phrases:

| Mode | 4+ char phrase | `%0A` (encoded `\n`) | Auto-wrap |
|---|---|---|---|
| **Inline** (height 20–24) | **Split into two adjacent stamps** with matching font / color / animation so they read as one phrase | **Forbidden** — at small heights each line becomes unreadable | **Forbidden** — cap each individual stamp at 3 chars (or 4 for short Latin) |
| **Block** (own-line, height ≥24) | OK as a single stamp | **Allowed** — explicit `%0A` for intentional 2-line layout. Keep total ≤15 chars (incl. the `%0A`) | Tolerable but usually less polished than explicit `%0A` |

The user has confirmed: 「改行文字もエンコードすれば入れられるんだよ」 —
`%0A` is a real tool, just **only for block mode** and within the
15-char total cap (see `references/verification.md` § 15-character
phrase cap).

```html
<!-- Bad inline: %0A produces tiny 2-line stamp -->
<img src=".../emoji/%E4%BF%9D%E5%AD%98%0A%E3%81%A7%E3%81%8D%E3%81%AA%E3%81%84?..." alt="保存できない" height="24" align="absmiddle">

<!-- Good inline: two adjacent stamps with matching style -->
<img src=".../emoji/%E4%BF%9D%E5%AD%98?font=gothic-bold&color=ef4444&animation=buruburu&speed=normal&background=transparent" alt="保存" height="24" align="absmiddle"><img src=".../emoji/%E3%81%A7%E3%81%8D%E3%81%AA%E3%81%84?font=gothic-bold&color=ef4444&animation=buruburu&speed=normal&background=transparent" alt="できない" height="24" align="absmiddle">

<!-- Good block: explicit %0A for own-line 2-line layout -->
![レビュー歓迎](https://mojiemoji.jozo.beer/emoji/%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%0A%E6%AD%93%E8%BF%8E?font=maru-bold&color=3b82f6&animation=spring&speed=slow&background=transparent&outline=darker&outline_width=2)
```

## Saturation Mode (Default On Body Surfaces)

For body-class surfaces (issue / PR / release / comment / reply) in
Japanese, **saturation is the default** — no trigger phrase required.
Render at this density unless the user explicitly says "static" /
"plain" / "no stamps" / "less".

### Anti-pattern: single-stamp body (density failure)

The recurring **failure mode** is composing a body that has ONE
mojiemoji at the very top (often above the badge line) and plain
Japanese prose for the rest. Block or inline — same disease. The
user has explicitly flagged this as the wrong default
("モジエモジの使い方下手になった。埋め込み方が悪くなった。スキルに忠実にやってる？").

**Concrete past failures**:

- **issue #166** (block-stamp + monotone): 15 stamps in the body but
  all with `font=maru-bold color=60a5fa animation=spring speed=normal`,
  including `Promise.all` and `Green` which should never have been
  stamped. Quantity without diversity is still failure.
- **issue #157** (single inline at top): shields line OK, then
  `## ステータス: post-POC <保留>` with `保留` as the only stamp in the
  entire body — rest of the body all plain prose. Same density-failure
  shape, just inline instead of block.

Under saturation default, **a body with ≤2 stamps total is a
composition error** — re-dispatch with the full PHRASES list before
shipping.

When you find yourself about to compose a Japanese body-class surface
and considering "let me just slap a single mojiemoji at the top and
ship it" — **stop**. Either:

1. **Delegate to `mojiemoji-selector`** with the full PHRASES list
   covering every emphatic noun/verb in the body, render at
   inline-saturation density, then compose around the returned
   snippets (recommended path), OR
2. **Skip mojiemoji entirely** with explicit reasoning (apology /
   security / legal / etc. — see do-not-stamp list)

### What this default density looks like

- Factual terms become OK to stamp as embeds when they fit
  grammatically. Concrete stampable list (non-exhaustive): `DB`, `E2E`,
  `テスト`, `ユニット`, `仕様`, `必須`, `確認`, `追加`, `変更`, `修正`,
  `更新`, `同期`, `対称`, `参照`, `紐付け`, `同居`, `準拠`, `判明`,
  `判断`, `基準`, `要件`, `存在`, `不足`, `保存`, `検証`, `検討`,
  `完了`, `未解決`, `未実施`, `重点`, `破壊的`, `無害`, `実質`, `注意`,
  `急ぎ`, `解決`, `異なる`, `同じ`, `揃える`, `分離`, `網羅`, `情報`,
  `原則`, `結果`, `本来`, `訂正`. Most multi-char tech-domain Japanese
  nouns/adjectives belong here. The do-not-stamp list (code, paths,
  identifiers, links — see "What stays" below) is the narrow exception.
- AC checklists, investigation lists can have stamps embedded in
  their prose.
- "Max 2 inline stamps per sentence" relaxes — chain as many as the
  sentence grammatically supports.
- Section headings can carry trailing block decoration freely.

### What stays absolute

- **Embed grammatical safety**: every embed must still parse.
- **Decoration on own line**: never tack decoration onto a prose
  sentence end. Use `→ <stamps>` line below instead.
- **Code, paths, identifiers, links**: never stamped.
- **Dark-mode-safe colors** (Tailwind 300–500 range; see
  `references/parameters.md` § Dark-mode-safe color palette).
- **Animation required**; never `spin` (silently static — see
  `references/parameters.md` § Valid animation values).
- **Animation diversity**: no single animation more than ~3× across
  the body; aim for **12+ distinct values** out of the canonical 33
  (see `references/parameters.md` § Animation diversity).

### Saturation constraint block (paste into mojiemoji-selector dispatch)

```
TONE: loud
MODE: inline
CONSTRAINTS:
- FLAVOR GATE OVERRIDE: render factual/design terms; do not skip.
- All inline; height=20 (matches user's observed body style)
- Animation required; never spin (silently static); only use names from the canonical 33 in references/parameters.md
- Animation diversity: 12+ distinct values across the body; no animation more than 2× across distinct terms
- Include at least 3 picks from the underused tier (ekken, tate_ekken, neruneru, patapata, mabataki, mozaiku, tatemoya, yokomoya, zairu, zanzo, chirichiri, kage_kaiten, kage_bokashi, kage_neon, kirari, yatta, kaiten, psycho)
- Avoid reusing the "safe defaults" (bane, nami, mochimochi, bure) more than once each per body — they're the historical bias the user has flagged
- Avoid animation=bakusan inline (radial-burst obscures letterforms — block-only). Likely-problematic inline: chuuou_zoom, mozaiku, kage_*. Prefer gatagata / bure / tenmetsu / shuchusen / zanzo for inline impact
- Font diversity: mix at least 3–4 distinct fonts from the canonical 17 (see references/parameters.md § Valid font values)
- Color: dark-mode-safe (Tailwind 300–500 range), bias toward 300–400
- background=transparent in every URL
- outline=darker outline_width=2 in every URL (auto-relative dark halo per stamp; never use outline=ffffff — white blends with light Tailwind 300–400 fills)
- Inline only. Do NOT generate own-line "→ <stamps>" section punch-line decoration or "---" + closing flair stamps. For trailing flair at sentence/heading end, use a Unicode emoji (🎉 💣 🔥 ✨ 🚀 etc.) instead — see ../../rules/github-markdown.md § Trailing decoration.
```

## Workflow

1. Identify surface (issue / PR body / review comment / reply /
   release note). If surface is **issue body / PR body / release
   note**, check badge coverage first (see § Pair With Badges).
2. Identify mode (`block` vs `inline`; mixed is allowed).
3. Compress any long phrasing into stamp-sized text (2–6 chars block,
   2–4 inline). For multi-segment phrases (e.g. `レビュー`+`歓迎`,
   `マージ`+`完了`, `修正`+`お願い`), insert a `%0A` line break in the
   URL text at the natural seam — block only. Inline phrases that
   exceed 3 chars must be split into two adjacent stamps. See
   `references/presets.md` § "Line Break Composition" for thresholds.
4. Select parameters:
   - **Single phrase, single obvious preset**: check
     `references/flavor-guide.md` first to confirm the phrase is
     stamp-worthy, then look up `references/presets.md` for one row
     and render via the script directly. No subagent needed.
   - **Anything else** (≥2 phrases, variants, a catalog, ambiguous
     placement, or tone constraints): **MUST delegate to the
     `mojiemoji-selector` subagent**. Do not load the references into
     the main thread.
   - **Hard ban: never loop the direct script per-phrase with frozen
     flags.** The fast path is single-phrase only. Calling
     `mojiemoji_markdown.rb` ≥2 times with the same `--font --color
     --animation --speed` is the exact mechanism that produced the
     monotonic body in issue #166 (15 stamps, all `font=maru-bold
     color=60a5fa animation=spring speed=normal`). Multi-phrase work
     always delegates to `mojiemoji-selector` so the diversity
     constraints in the Hard contract get applied across the body.
5. Compose the final message around the returned snippets. Keep
   surrounding prose natural; for inline, let the stamp act as
   emphasis.
6. **Body composition (issue body / PR body / release note — loud
   tone)**:
   - **Required default — Inline density: 1–2 stamps per paragraph.**
     Pick the most emphatic key terms in each paragraph. In
     idea-bearing bullets (要件 / acceptance), embed every
     noun/verb that fits grammatically. Saturation does **not** mean
     stamping every word — it means consistent presence with
     selectivity. In sections that contain code paths / identifiers
     / links (関連ファイル, 関連 PR, references), the path/identifier
     itself is never stamped, but the surrounding Japanese prose
     (relationship descriptors like 「差し替え対象」、parentheticals
     like 「変更不要の想定」) IS stampable and *should* be stamped
     under inline saturation.
   - ✗ **Section punch-line decoration** (own-line `→ <stamp1>` after
     a section) — **do not generate**. The only escape valve is an
     explicit user request containing both block-decoration intent
     ("→ つけて" / "盛大に") and a specific placement.
   - ✗ **Closing flair** (`---` + own-line mood stamps at body end)
     — **do not generate**. Same escape valve.
7. **Verify before pasting.** After receiving snippets, run the
   spot-check block in `references/verification.md` against the full
   body. If any check fails, fix locally (or re-dispatch) before
   pasting.
8. If the user asks to actually post the result, compose first, then
   invoke `gh` commands.

## Delegation

Dispatch the `mojiemoji-selector` subagent via the `Agent` tool with
`subagent_type: "mojiemoji-selector"`. Send the input in the contract
format:

```
SURFACE: <issue-body|pr-body|review-comment|reply|release-note>
MODE:    <block|inline|mixed>
TONE:    <calm|neutral|loud>
PHRASES:
- <phrase> — <intent in one short clause>
- <phrase> — <intent>
CONSTRAINTS (optional):
- <e.g. "avoid red", "match thread tone">
SKILL_DIR: /Users/<you>/.config/claude/skills/mojiemoji-github
```

Pass `SKILL_DIR` as an absolute path so the subagent does not have to
guess. The subagent returns a compact `phrase | mode | snippet`
table. Nothing else enters your context.

Escalate `model: opus` only when the user asks for a large catalog or
fine taste tuning; the default `sonnet` is enough for most cases.

### Hard contract for every dispatch

The subagent has historically dropped these — **always include the
following lines verbatim in `CONSTRAINTS`** so no snippet escapes
without them:

```
- Every URL MUST include &background=transparent
- Animation MUST come from the canonical list (see references/parameters.md § Valid animation values); never `spin`
- Font MUST come from the canonical list (see references/parameters.md § Valid font values); never `della` (correct: `dela`)
- Color MUST be dark-mode-safe (Tailwind 300–500 range; never 600+ or near-black). See references/parameters.md § Dark-mode-safe color palette.
- For inline mode: height=20 is the observed user default. **Confirmed block-only**: `bakusan` (radial-burst obscures letterforms at small heights). **Likely problematic inline**: `chuuou_zoom`, `mozaiku`, `kage_*` shadow effects. Substitute `gatagata` / `bure` / `tenmetsu` / `shuchusen` / `zanzo` for inline impact moods.
- For inline mode with 4+ char phrases: split into two adjacent single-line stamps (matching font/color/animation), do NOT use `%0A` line break in the URL
- Outline: use `outline=darker outline_width=2` (auto-relative dark halo per stamp). Never use `outline=ffffff` — white blends with light Tailwind 300–400 fills and erases the letterform edges.
- **Animation diversity**: across the full PHRASES list, use **12+ distinct values** from the canonical 33 (see references/parameters.md § Valid animation values). **No animation may appear more than 2×** across distinct terms. Same-term recurrences (e.g. 仕様 × 5) are exempt — count distinct *terms*, not occurrences. Single-animation bodies are the issue #166 anti-pattern.
- **Underused tier requirement**: include at least **3 stamps using animations from the underused tier** (ekken, tate_ekken, neruneru, patapata, mabataki, mozaiku, tatemoya, yokomoya, zairu, zanzo, chirichiri, kage_kaiten, kage_bokashi, kage_neon, kirari, yatta, kaiten, psycho). The user has flagged a recurring bias toward "safe defaults" (`bane`, `nami`, `mochimochi`, `bure`); this rule forces breakout from that comfort zone.
- **Font diversity**: mix at least **3–4 distinct fonts** from the canonical 17. Picking display fonts (`akzk`, `zero`, `kurobara`, `hachimaru`, `chikara`, `tamanegi`, `toge`, `rampart`) for the loudest words and `gothic-bold` / `maru-bold` / `noto-sans-jp` for readability-sensitive ones works well.
- **Color diversity**: use **4+ distinct hex values** across the body, all from the dark-mode-safe palette (Tailwind 300–500). Single-color body is also the #166 anti-pattern (15 stamps, all `60a5fa`).
- FLAVOR GATE OVERRIDE (saturation / loud tone): render EVERY phrase in the PHRASES list. Do NOT skip with "do-not-stamp" reasoning unless the phrase is literally an API name, file path, version string, code identifier, or apology/legal/compliance text. Multi-char Japanese tech nouns and verbs (紐付け, 同居, 修正, 準拠, ユニット, 検証, 検討, 実装, 反映, 伝播, 報告, etc.) ARE stampable. See SKILL.md § Saturation Mode for the concrete stampable list. If unsure, render — the main thread spot-checks before pasting.
```

### Hard rule: do-not-stamp identifiers (carve-out from FLAVOR GATE OVERRIDE)

Even under saturation / loud tone with FLAVOR GATE OVERRIDE active,
**these always stay plain text**. Never render as a stamp regardless
of how stamp-rich the surrounding body is:

- **API names / language built-ins**: `Promise.all`, `Promise`,
  `useState`, `useEffect`, `Map`, `Map.from`, `Vec::new`, `Result`,
  `Option`, `Iterator::find`
- **English single-word identifiers / verdicts**: `Green`, `Red`,
  `Blue`, `null`, `undefined`, `OK`, `NG`, `Yes`, `No`, `True`,
  `False`, `Success`, `Error`
- **File paths**: `apps/api/src/...`, `packages/db/...`, `Sources/Foo.swift`
- **Version strings**: `v1.2.3`, `0.4.0`, `Node 20`
- **Code symbols / type names**: `MatchingHistory`, `creativeIntegrity`,
  `WallpaperLoadingOverlay`
- **URLs, hashes, issue/PR numbers**: `#166`, `abc1234`,
  `https://...`
- **Numerics with units**: `100ms`, `200lines`, `5指標`の数字部分

These have **no stamp slot** even if they appear in a stamp-saturated
sentence. The Japanese prose around them IS stampable (and *should*
be under saturation), but the identifier itself stays bare.

**Concrete past failure (issue #166)**: `Promise.all` and `Green` were
rendered as stamps. `Promise.all` is a JavaScript API name. `Green`
is an English verdict word. Both belong in this list — they should
have stayed plain.

When in doubt, ask: "would a code reviewer expect to grep for this
string verbatim?" If yes (any identifier / API / path), it's not
stampable. If it's only meaningful as Japanese prose (修正, 検証, 紐付け,
保留, 着地), stamp it.

After receiving snippets, run the verification block in
`references/verification.md` § Post-dispatch spot-check. Do not ship
a body with any failing check.

## Direct Script (single-phrase fast path)

```bash
# Block
scripts/mojiemoji_markdown.rb --text 'レビュー歓迎' \
  --font maru-bold --color 3b82f6 --animation bane --speed slow

# Inline (height=24 align=absmiddle)
scripts/mojiemoji_markdown.rb --text 'マジで' --inline \
  --font maru-bold --color ef4444 --animation bure --speed normal
```

Flags: `--text`, `--alt`, `--html`, `--inline`, `--height`, `--width`,
`--align`, `--font`, `--color`, `--animation`, `--speed`, `--gradient`,
`--flip`, `--padding`, `--background`, `--outline`, `--outline-width`,
`--path`, `--query`, `--base-url`.

`--background` defaults to `transparent` and is emitted on every URL
unless explicitly overridden. `--outline` is opt-in (recommended for
body-class surfaces).

## Defaults

- **Animate by default.** Every stamp gets an animation preset —
  static is the exception, not the rule. Pick motion that matches the
  mood (celebratory → `bane` / `kira` / `kirari` / `yatta`, urgent →
  `gatagata` / `bure` / `tenmetsu` / `shuchusen`, neutral status →
  `yurayura` / `mochimochi` / `nami`). Drop animation only when it
  actively hurts: dense paragraphs with many inline stamps, or somber
  contexts (apology bodies, incident postmortems).
- When delegating to `mojiemoji-selector`, `TONE: calm` still implies
  animation — just a slower/softer one. Set
  `CONSTRAINTS: "no animation"` explicitly only when the user asks
  for static.
- **`background=transparent` always (unless intentionally set).**
  Mojiemoji's default background is white — leaving it unset makes
  the stamp clash with dark-mode GitHub. The script emits
  `background=transparent` on every URL by default. Override with
  `--background <color>` **only** when the user explicitly asks for a
  colored background; in that case confirm the result reads on both
  light and dark before shipping.
- **Outline on body-class surfaces**: `outline=darker outline_width=2`.
  Never `outline=ffffff` with light Tailwind 300–400 fills. See
  `references/parameters.md` § Outline.

For canonical animation / font / color values, inline-height
guidance, and the "when parameters stop working" recovery procedure,
see `references/parameters.md`.

For service hard limits (15-char cap, pre-flight HTTP check) and the
post-dispatch verification bash block, see `references/verification.md`.

## Output Rules

- Return ready-to-paste snippets, not prose descriptions.
- For issue body / PR body / release note: confirm shields.io badges
  are present at the top of the body (separate paragraph from
  stamps). Badges-without-stamps is fine; stamps-without-badges on
  these surfaces is the recurring miss.
- For block, prefer headings, callouts, checklists, and closing lines
  over dense paragraphs.
- For inline, keep the host sentence natural. On Japanese body-class
  surfaces, default to inline-saturated (1–2 embeds per paragraph
  minimum).
- **Code paths, identifiers, links are not stampable, but the prose
  around them is.** When a bullet reads
  `` `Sources/Foo.swift:40-55` — `WallpaperLoadingOverlay` (差し替え対象) ``,
  the file path and symbol stay plain — but the descriptor in
  parentheses (`差し替え対象`, `変更不要の想定`, `重点`, `導入`) is
  Japanese prose and **should be stamped** under inline-saturation
  default. Same for sentences like
  「`WallpaperPresenter` の状態を *維持* する」 — the symbol stays
  bare, the descriptor takes a stamp.
- If a phrase violates the flavor-guide do-not-stamp list, drop it
  silently or call it out — never decorate API names, versions,
  apology bodies, or security/legal text.
- **Spot-check is required, not optional, for body-class surfaces
  with ≥3 stamps.** Run `references/verification.md` § Post-dispatch
  spot-check (steps 1–14) against the full body before pasting.
  Diversity violations slip past eyeball review — issue #166 had 15
  stamps and looked "decorated" at a glance, but the spot-check would
  have caught: only 1 distinct animation, only 1 distinct color,
  `Promise.all`/`Green` in the identifier-stamp check.
