# Mojiemoji Presets For GitHub

Use these presets as defaults for GitHub markdown. They are tuned for internal use where expressive visual noise is acceptable and often desirable.

## Core Rule

- Prefer mojiemoji as a stamp.
- Keep body prose normal.
- Use more snippets when the user explicitly wants a loud style.
- Avoid very long phrases because the public API does not currently expose a line-balance parameter.

## Block vs Inline

Two placement modes exist. Pick before choosing any other parameter.

| Mode | When | Output form | Phrase length |
|---|---|---|---|
| `block` | Own line: headings, callouts, checklists, closing lines | Markdown `![alt](url)` | 2–6 chars |
| `inline` | Mid-sentence emphasis, e.g. 【マジで】やばい【バグ】ですね | HTML `<img ... height align>` | 2–4 chars |

### Inline Rendering Rules

- GitHub sanitizer strips `style` and ignores CSS units on `height`. Use integer pixels only.
- Typical GitHub body line-box is ~21px. `height="20"` is the user's observed default in actual bodies; `height="24"` is also valid. Either reads cleanly. Raise to 28–32 only when the user asks for a louder style.
- Always pair with `align="absmiddle"` so the stamp sits on the text middle.
- Most animations are valid inline. **`bakusan` is block-only** — its radial-burst motion obscures inner letterforms at the default `height="20"–"24"` (see `parameters.md` § Valid animation values). All other animations including `kira` are welcome inline. Vary deliberately for diversity (see SKILL.md § Animation diversity).
- Keep to at most 2 inline stamps per sentence in calm/neutral tone. In saturation/loud tone the per-sentence cap relaxes.

## Font Roles

| Font | Use for |
|---|---|
| `gothic-bold` | Practical status, WIP, investigation, completion |
| `maru` | Soft thanks, waiting, friendly nudges |
| `maru-bold` | Friendly but visible review or request prompts |
| `mincho` | Heavy announcements, caution, formal emphasis |
| `pixel` | Celebration, playful approval, release vibes |
| `dela` | Loud title-like emphasis |

## Speed Roles

| Speed | Use for |
|---|---|
| `slow` | Default for GitHub comments and bodies |
| `normal` | Default for celebratory stamps |
| `fast` | Rarely; only for intentionally loud urgency or jokes |
| `step` | Mechanical or retro vibe |

## Animation Bias: `kira`

The user has a soft spot for `kira` (hue-rotating color cycle). Apply
this global bias when picking animations:

- **Bias toward `kira`** for celebratory / triumphant / "made it" stamps
  — `LGTM`, `完成`, `リリース`, `マージした`, `ありがとう`, `お疲れ様`,
  `めでたい`. Pick `kira` more often than the table's default suggests.
- **Never `kira`** for caution / warning / error / blocker stamps
  (`注意`, `バグ`, `要修正`, `緊急`, `困った`) — keeps the loud effect
  meaningful.
- **At most one `kira` per message / issue / PR / comment.** Stacking
  multiple cycling stamps kills the eye-catching effect ("極端はダメ").
  Default the rest to non-kira animations.
- **`kira` is welcome inline** when the mood calls for it — the older
  "inline never kira" rule has been lifted. Use it for celebratory
  punch-line emphasis mid-sentence.

## Tone Presets

| Phrase | Context | Font | Color | Animation | Speed | Notes |
|---|---|---|---|---|---|---|
| `WIP` | PR draft, issue progress | `gothic-bold` | `f59e0b` | none | - | Stable default |
| `調査中` | Investigation | `gothic-bold` | `f59e0b` | `yoko_scroll` | `slow` | Good for ongoing exploration |
| `確認待ち` | Waiting | `maru` | `60a5fa` | `yurayura` | `slow` | Soft pressure |
| `レビュー歓迎` | Review requested | `maru-bold` | `3b82f6` | `bane` | `slow` | Friendly request |
| `見てほしい` | Explicit review nudge | `maru-bold` | `2563eb` | `poyoon` | `slow` | A bit more playful |
| `修正中` | Fix in progress | `gothic-bold` | `fb923c` | `norinori` | `slow` | Active movement |
| `修正済み` | Addressed | `gothic-bold` | `22c55e` | `mochimochi` | `slow` | Gentle completion |
| `直した` | Casual fix note | `maru-bold` | `10b981` | `poyoon` | `slow` | Friendly tone |
| `LGTM` | Approval | `pixel` | `22c55e` | `bane` | `normal` | Strong classic |
| `よさそう` | Softer approval | `maru-bold` | `34d399` | `mabataki` | `slow` | Not too loud |
| `ありがとう` | Thanks | `maru` | `ec4899` | `yurayura` | `slow` | Warm default |
| `助かる` | Appreciation | `maru-bold` | `f472b6` | `mochimochi` | `slow` | Short and stampy |
| `急ぎ` | Urgent attention | `dela` | `ef4444` | `disco` | `normal` | Intentionally loud |
| `重要` | Important note | `mincho` | `dc2626` | `shuchusen` | `slow` | Dramatic emphasis |
| `要相談` | Discussion needed | `mincho` | `8b5cf6` | `nami` | `slow` | Signals ambiguity |
| `困った` | Blocked | `maru-bold` | `f97316` | `gatagata` | `slow` | Use sparingly |
| `マージした` | Merge done | `pixel` | `22c55e` | `yatta` | `normal` | Celebration |
| `出した` | PR or release posted | `pixel` | `06b6d4` | `bakusan` | `normal` | Announcement |
| `リリース` | Release note | `pixel` | `a855f7` | `kaiten` | `normal` | Festive |
| `めでたい` | Internal celebration | `pixel` | `f59e0b` | `kira` | `normal` | Bright and playful |

## Placement Guidance

- Issue body:
  - Opening status stamp
  - Section heading accents
  - Closing ask
- PR body:
  - Top status stamp
  - Review request near checklist
  - Merge or release note near the bottom
- Review comment:
  - One stamp is usually enough unless the user wants a loud style
- Follow-up reply:
  - `修正済み`
  - `確認待ち`
  - `ありがとう`

## Inline Stamp Presets

Use short, punchy phrases. Calm animations only. `height=24 align=absmiddle` by default.

| Phrase | Context | Font | Color | Animation | Speed |
|---|---|---|---|---|---|
| `マジで` | Emphatic modifier before an adjective | `maru-bold` | `ef4444` | `bure` | `normal` |
| `バグ` | Point at a defect inline | `gothic-bold` | `dc2626` | `gatagata` | `slow` |
| `注意` | Inline caution | `mincho` | `f59e0b` | `mabataki` | `slow` |
| `ここ` | Inline pointer to a location in code | `maru-bold` | `3b82f6` | `poyoon` | `slow` |
| `これ` | Inline demonstrative emphasis | `maru-bold` | `60a5fa` | `yurayura` | `slow` |
| `多分` | Hedging mid-sentence | `maru` | `94a3b8` | `yurayura` | `slow` |
| `要注意` | Inline caution stronger than 注意 | `mincho` | `dc2626` | `mabataki` | `slow` |
| `OK` | Inline approval mid-sentence | `pixel` | `22c55e` | `mabataki` | `slow` |
| `NG` | Inline rejection mid-sentence | `pixel` | `ef4444` | `mabataki` | `slow` |
| `草` | Internal amusement stamp | `maru-bold` | `22c55e` | `poyoon` | `slow` |

## Line Break Composition

Multi-segment phrases render better as **two balanced lines** than as one
long single-line stamp. Encode `%0A` in the URL `text` portion at the
natural semantic seam. Keep the markdown `alt` text on **one line** —
embedding a literal newline in `alt` breaks some markdown parsers.

### When to apply

- **4 characters → split 2+2 by default.** This is the global rule:
  any 4-char phrase wraps to two balanced 2-char lines unless it is an
  idiom that reads as a single unit (see "When to skip").
  Examples: `糖衣`+`構文`, `動作`+`確認`, `修正`+`完了`, `本番`+`反映`,
  `仕様`+`変更`, `要件`+`定義`.
- 5+ characters with a clear semantic seam between two sub-phrases.
  Examples: `レビュー`+`歓迎`, `マージ`+`完了`, `修正`+`お願い`,
  `確認`+`お願い`, `デプロイ`+`完了`, `リリース`+`準備`.
- Aim for balanced widths on both lines (2–4 chars per line).

### When to skip

- 2–3 character single-segment phrases: `バグ`, `注意`, `これ`, `ここ`,
  `OK`, `NG`, `草`
- Idioms / words that read as one unit: `あとちょい`, `ありがとう`,
  `おつかれ`, `LGTM`
- Inline stamps (mode = `inline`) — keep them single-line for typographic
  flow within a sentence

### How

1. Find the natural seam (between the two sub-phrases).
2. In the URL path, replace the seam with `%0A`. Each side should be
   roughly balanced in width (2–4 chars per line works well).
3. Leave the markdown `alt` text as the joined single-line form.

### Example

```md
![レビュー歓迎](https://mojiemoji.jozo.beer/emoji/%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%0A%E6%AD%93%E8%BF%8E?font=maru-bold&color=3b82f6&animation=bane&speed=slow)
```

Renders as two balanced lines (`レビュー` / `歓迎`) inside the stamp,
while the alt text stays `レビュー歓迎` for accessibility and parser
compatibility.

This is a global default in the `mojiemoji-github` skill — apply on every
invocation that matches the criteria above.

## Example Snippets

Block (own line):

```md
![レビュー歓迎](https://mojiemoji.jozo.beer/emoji/%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E6%AD%93%E8%BF%8E?font=maru-bold&color=3b82f6&animation=bane&speed=slow)
```

```md
修正しました。![確認待ち](https://mojiemoji.jozo.beer/emoji/%E7%A2%BA%E8%AA%8D%E5%BE%85%E3%81%A1?font=maru&color=60a5fa&animation=yurayura&speed=slow)
```

```md
![LGTM](https://mojiemoji.jozo.beer/emoji/LGTM?font=pixel&color=22c55e&animation=bane&speed=normal)
```

Inline (mid-sentence):

```md
この関数は<img src="https://mojiemoji.jozo.beer/emoji/%E3%83%9E%E3%82%B8%E3%81%A7?font=maru-bold&color=ef4444&animation=bure&speed=normal" alt="マジで" height="24" align="absmiddle">やばい<img src="https://mojiemoji.jozo.beer/emoji/%E3%83%90%E3%82%B0?font=gothic-bold&color=dc2626&animation=gatagata&speed=slow" alt="バグ" height="24" align="absmiddle">ですね。
```
