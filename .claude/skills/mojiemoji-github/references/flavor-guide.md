# Mojiemoji Flavor Guide

Mechanical placement (which surface, which mode) is covered in `SKILL.md`.
This file is the **taste layer**: what makes a stamp actually land, and what
turns it into noise. Read this before choosing phrases — it matters more than
which font or color you pick.

## Principles

### 1. Stamp modifiers and verdicts, never nouns

The stamp should add mood to another word, not replace information.

- Good: `【マジで】やばい【バグ】ですね` — adverb + verdict stamp
- Good: `動くけど【微妙】` — judgment word stamp
- Bad: `【関数】をリファクタ` — noun stamp adds no mood, only noise
- Bad: `【API】を叩く` — factual reference, never stamp

### 2. Sit on the emotional pivot

The stamp belongs at the place where a sentence turns from fact to judgment,
or from setup to reaction.

- `通ったが【納得いかない】`
- `動くけど【謎】`
- `直ったけど【真因不明】`

### 3. Punch line, not setup

One stamp on the last beat beats three stamps on the setup. Comedy timing.

- Good: `調べたら【完全に別案件】でした。`
- Bad: `【調べたら】【完全に別案件】でした。` — preamble stamped, energy wasted

### 4. After a contrast marker is prime real estate

Negations, adversatives, and reversals set up the landing.

- `〜だけど【正直】微妙`
- `〜したのに【なぜか】通る`
- `〜のはずが【まさかの】成功`

### 5. Self-deprecation > apology

Stamping your own mistake is stronger and less heavy than apologizing.

- `【やらかし】直します` > `申し訳ありません、修正します`
- `【誤読】でした` > `勘違いしていました`
- `【完全に草】` > `失礼しました笑`

### 6. Decisions and verdicts at the end of a review

A final stamp at the end of a review block carries the whole verdict.

- `このPRは……（議論）…… 結論: 【マージして良し】`
- `…動作確認しました。【OK】`

## Do Not Stamp

| Area | Why |
|---|---|
| API names, file paths, identifiers | Hurts searchability and quoting |
| Numbers, versions, dates | Factual density; stamping obscures the value |
| Apology body in incident/security reports | Undermines seriousness |
| Security findings or risk descriptions | Tone mismatch; readers discount the finding |
| Requirements / acceptance criteria | Specs must stay literal |
| Legal / compliance text | Same reason — never decorate |

## Quantity Rules

| Context | Max inline stamps | Max block stamps |
|---|---|---|
| Formal review on production code | 0–1 | 0–1 |
| Regular PR review / team issue | 1–2 per paragraph | 1 per section |
| Internal chat-like thread | 2–3 | a few |
| Intentional loud mode (user asks for it) | no cap | no cap |

Default: assume formal-to-regular unless the user explicitly signals loud mode
("もっと盛って", "うるさめで", "祭り", etc.).

## Quick Checklist Before Stamping

1. Is the target a **modifier, verdict, or emotion** (not a noun)?
2. Is it on the **pivot or punch line** of the sentence?
3. Would removing the stamp make the sentence factually incomplete? If yes,
   you are replacing information — back out.
4. Is the surface tone suitable (not incident, legal, or security-critical)?

If any answer is "no", skip the stamp. A well-placed single stamp is stronger
than three mediocre ones.

## Grammatical Safety Check (Embed Mode)

Before inserting a stamp **inline as an embed** (replacing a word in a
sentence — distinct from decoration on its own line), perform this
check:

> Read the sentence aloud with the stamp's `alt` text in place of the
> stamp. Does it parse as natural Japanese?

If the answer is no, the embed is broken — either drop the stamp or
move it to a decoration line below the prose.

| Example | Parse | Verdict |
|---|---|---|
| `カラムが【グッド】で存在する` | "カラムがグッドで存在する" — adverbial slot needs `順調に` / `ちゃんと`, not the noun-verdict `グッド` | Broken — drop |
| `カラムが【存在】する` | "カラムが存在する" — verbal-noun `存在` already fills the slot | OK |
| `…したい【マジで】【大事】。` | "…したいマジで大事。" — runs together; reader can't tell where the sentence ends | Broken — move to `→ 【マジで】【大事】` decoration line |
| `通ったが【納得いかない】` | "通ったが納得いかない" — natural connection | OK |

This rule applies even in **saturation mode** ("マシマシ" / "二郎系" /
"絵文字入れまくって"). Saturation relaxes which terms are stamp-eligible
(factual terms like `DB`, `E2E`, `仕様` become OK), but it does **not**
relax the requirement that embeds form grammatical sentences.

## Embed vs Decoration

The `inline` mode covers two patterns that look identical in source
but read very differently in rendered prose:

| Pattern | Where | Rule |
|---|---|---|
| **Embed** | Mid-sentence | Stamp replaces a word; must pass the Grammatical Safety Check |
| **Decoration** | Own line below the prose | Stamp adds mood without grammatical role; prefix with `→ ` (or wrap in `【...】`) |

**Never tack decoration onto the end of a prose sentence.** The
trailing stamp visually merges with embeds and the reader cannot tell
where the sentence ends. Section-heading trailing decoration is fine
(headings are visually distinct from prose).

```markdown
<!-- Bad: trailing decoration on prose -->
…してほしい <マジで> <大事>。

<!-- Good: decoration on dedicated line -->
…してほしい。

→ <マジで> <大事>

<!-- Good: heading-trailing decoration -->
## デプロイ順序 <大事>
```

## Saturation Mode

When the user explicitly requests max-loud usage — "マシマシ", "二郎系",
"盛って", "絵文字入れまくって", "saturate" — relax these:

- Factual terms (`DB`, `E2E`, `仕様`, `要件`, `対称`, `判断`, `基準`)
  become OK to embed when they fit grammatically.
- AC checklists and investigation lists can carry stamps.
- "Max 2 inline stamps per sentence" relaxes — chain as many as the
  sentence grammatically supports.

What stays absolute:

- Grammatical Safety Check above.
- Decoration goes on its own line, never trailing prose.
- Code, paths, identifiers, version strings, links — never stamped.
- Dark-mode-safe colors (Tailwind 300–500 range, bias 300–400; SKILL.md § Dark-mode-safe color palette).
- Animation required; never `spin` (silently static). `bakusan` is **block-only** — its radial-burst motion obscures inner letterforms at inline heights (see `parameters.md` § Valid animation values). All other animations including `kira` are welcome inline.
