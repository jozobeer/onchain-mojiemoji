# Mojiemoji Parameters Reference

Canonical parameter values for the mojiemoji.jozo.beer service. Loaded
on demand from SKILL.md when composing or delegating to
`mojiemoji-selector`.

## Inline height: 24 default, 20 also valid

The skill's documented default is `height="24"` (reads well at body
font size). The user has been observed using `height="20"` in actual
bodies. Both are acceptable:

- `height="24"` — recommended for readers / surfaces unfamiliar with
  the user's voice; safer default.
- `height="20"` — the user's observed personal preference; slightly
  more compact, closer to baseline text height. Use this when matching
  the user's existing bodies in the same repo.

When you can see the user's other bodies in the repo, mirror their
`height` choice for visual coherence.

## Valid animation values (canonical)

The mojiemoji service silently renders **static** when an unknown
animation name is passed. Use only values from this list — anything
else fails open with no error. **The vocabulary expanded significantly
since the previous cached spec; many older English names were renamed
to Japanese romaji** (e.g., the old `spring` is now `bane`, `wave` is
`nami`, `scroll` is `yoko_scroll`, `blink` is `mabataki`, `kanpai` is
`yatta`, `roulette` is `kaiten`, `strobe` is `disco` or `psycho`,
`buruburu` is `bure`). Use the live names below.

```
tate_scroll, yoko_scroll, ekken, tate_ekken, bane, gatagata, bure,
chuuou_zoom, kirari, kira, tenmetsu, shuchusen, kaiten, neruneru,
patapata, yurayura, mabataki, bakusan, norinori, mochimochi, mozaiku,
poyoon, yatta, tatemoya, nami, yokomoya, zairu, zanzo, chirichiri,
disco, psycho, kage_kaiten, kage_bokashi, kage_neon
```

That's 33 distinct animations — far more than the historical 16. The
diversity rule (below) leverages this width.

Common bad values to avoid: `spin` (not a real animation — silently
static), `rotate`, `bounce`, `shake`, plus any of the renamed-away
old English names (`spring`, `wave`, `scroll`, `blink`, `kanpai`,
`roulette`, `strobe`, `buruburu`). If unsure whether a name is current,
fetch `https://mojiemoji.jozo.beer/` and re-verify (see § When
parameters stop working).

Most animations are valid inline. **Confirmed block-only: `bakusan`**
— its radial-burst motion obscures the inner letterforms at the
default `height="20"–"24"`. Reserve `bakusan` for block mode only
(own-line stamps where `height ≥ 24` absorbs the burst).

**Likely problematic inline (test before relying on)**: `chuuou_zoom`
(center zoom — same letterform-obscuring issue at small heights),
`mozaiku` (mosaic — turns text into pixels), and the `kage_*` shadow
effects which need a clean foreground that may not survive at 20 px.
For inline impact / urgent / explosive moods, prefer `gatagata`
(rattle), `bure` (blur), `tenmetsu` (flash), `shuchusen` (concentration
lines), or `zanzo` (afterimage) — all read clearly at small heights.

Don't chain three loud animations in the same sentence — the existing
"max 2 inline stamps per sentence" rule (relaxes in saturation mode)
is still the natural pacing guard.

### Animation diversity (anti-monotony)

**Spread animation choices wide across the canonical list.** A body
with 20 stamps that all use `bane` reads as monotonous — the user has
explicitly flagged this as a recurring failure mode. With 33
animations available, the historical 8-distinct floor is too lenient;
push for **12+ distinct animations** per body-class surface, with **no
animation appearing more than 2×** across distinct terms.

The user has observed a recurring bias toward a small set of "safe"
defaults (the historical `spring/wave/mochimochi/buruburu` quartet,
now `bane/nami/mochimochi/bure`). To break the bias, every body should
pull at least **3 stamps from the "underused tier"** below — animations
that rarely surface in default mood-to-animation mappings:

```
ekken, tate_ekken, neruneru, patapata, mabataki, mozaiku, tatemoya,
yokomoya, zairu, zanzo, chirichiri, kage_kaiten, kage_bokashi,
kage_neon, kirari, yatta, kaiten, psycho
```

Rough mood-to-animation mapping (a starting palette, not a lock-in —
fan out and pull from the underused tier even when a "safe" pick is
available). Most animations work in both `block` and `inline`; the
block-only / likely-block notes are called out in the rightmost column:

| Mood | Inline-safe candidates | Block-preferred / risky inline |
|---|---|---|
| Celebratory / completion | `bane`, `kira`, `kirari`, `yatta`, `norinori`, `disco`, `kage_neon` | `bakusan` |
| Urgent / warning / impact | `gatagata`, `bure`, `tenmetsu`, `shuchusen`, `zanzo` | `bakusan`, `chuuou_zoom` |
| Discovery / focus | `mabataki`, `tenmetsu`, `kaiten`, `tate_scroll`, `yoko_scroll` | `chuuou_zoom` |
| Soft / gentle / status | `yurayura`, `poyoon`, `mochimochi`, `nami`, `neruneru`, `chirichiri`, `patapata` | — |
| Energy / momentum | `norinori`, `bane`, `yatta`, `patapata`, `disco` | `bakusan` |
| Mood pivot / pop | `poyoon`, `kira`, `kirari`, `kage_neon` | `psycho` (intense) |
| Effect / texture | `mozaiku`, `tatemoya`, `yokomoya`, `zairu`, `kage_kaiten`, `kage_bokashi` | `psycho`, `mozaiku` |
| Scrolling / continuous | `tate_scroll`, `yoko_scroll`, `ekken`, `tate_ekken`, `kaiten` | — |

When delegating to `mojiemoji-selector`, add an explicit constraint:

```
- Animation diversity: across the full PHRASES list, use at least 12
  distinct values from the canonical 33. No animation should appear
  more than 2× across distinct terms. Include at least 3 picks from
  the underused tier (ekken, tate_ekken, neruneru, patapata, mabataki,
  mozaiku, tatemoya, yokomoya, zairu, zanzo, chirichiri, kage_kaiten,
  kage_bokashi, kage_neon, kirari, yatta, kaiten, psycho). Avoid
  reusing the same "safe defaults" (bane, nami, mochimochi, bure)
  more than once each per body. Same-term recurrences (e.g., 仕様 × 5)
  count as one term and may keep a stable animation for visual
  consistency.
```

When the same term recurs (e.g., 仕様 appearing 5 times), it is OK
to keep its animation/font/color stable for visual consistency
**within a single body**. The diversity rule is across distinct
terms, not against repeated occurrences of the same term.

## Valid font values (canonical)

```
gothic, gothic-bold, maru, maru-bold, mincho, dela, akzk, zero,
kurobara, hachimaru, chikara, tamanegi, pixel, toge, rampart, noto,
noto-sans-jp
```

Common typo to avoid: `della` (correct: `dela`). The old cached list
was 6 fonts; the live list is 17. New options include `gothic`
(non-bold variant), several display fonts (`akzk`, `zero`, `kurobara`,
`hachimaru`, `chikara`, `tamanegi`, `toge`, `rampart`), and `noto` /
`noto-sans-jp` for clean readable text. As with animations, font
diversity helps — a body where every stamp uses `maru-bold` is
monotonous. Mix at least 3–4 distinct fonts per body, picking
display fonts for the loudest words and `gothic-bold` / `maru-bold`
/ `noto-sans-jp` for readability-sensitive ones.

## Valid speed values

```
step, slow, normal, fast
```

`step` is a frame-by-frame variant added since the cached spec —
useful when the animation should look mechanical / pixelated rather
than smooth. Default is `~40ms/frame` if unspecified.

## Dark-mode-safe color palette

GitHub's dark theme background is near-black (`#0d1117`). Tailwind
shades 600+ render with low contrast on this background and read as
"black on black" (a recurring user complaint). Bias toward shades
**300–500** — the user's observed preference leans toward the lighter
end of this range (300–400).

| Hue | Avoid (too dark) | Prefer (lighter end first) |
|---|---|---|
| Red | `dc2626`, `b91c1c`, `991b1b` | `fca5a5`, `f87171`, `ef4444` |
| Orange | `c2410c` | `fdba74`, `fb923c`, `f97316`, `f59e0b` |
| Yellow | `ca8a04` | `fde047`, `facc15`, `fbbf24` |
| Green | `15803d`, `16a34a` | `86efac`, `4ade80`, `22c55e`, `34d399`, `10b981` |
| Cyan | `0e7490` | `67e8f9`, `22d3ee`, `06b6d4` |
| Blue | `1d4ed8`, `2563eb` | `93c5fd`, `60a5fa`, `3b82f6` |
| Indigo | `4338ca` | `a5b4fc`, `818cf8`, `6366f1` |
| Purple | `7e22ce` | `d8b4fe`, `c084fc`, `a855f7`, `8b5cf6`, `a78bfa` |
| Pink | `be185d` | `f9a8d4`, `f472b6`, `ec4899` |

Black, near-black (`#000000`–`#1f2937`), and very dark grays must
never be used as the stamp text color. Test mentally: "would this
color be readable on a black T-shirt?" If no, brighten it.

## Outline (recommended for body-class surfaces)

The mojiemoji service supports `outline` (color, hex or `darker` /
`lighter`) and `outline_width` (0..4 px integer; 0 = no outline).
An outline gives stamps a halo that anchors the letterform against
varied backgrounds — both light and dark mode GitHub.

Recommended defaults for body-class surfaces (issue body / PR body /
release note):

```
outline=darker          # auto-relative dark halo per stamp; self-anchors against any background
outline_width=2         # noticeable but not bulky; 1 is subtle, 3+ is bulky
```

Why `darker` is the default: with dark-mode-safe fills (Tailwind
300–500, biased to 300–400), a white outline (`outline=ffffff`)
blends into the light fill and erases the letterform edges, making
the stamp hard to read on dark GitHub backgrounds. `darker` auto-tints
relative to the fill color (yellow stamp → dark-yellow halo, pink
stamp → dark-pink halo), so every stamp self-anchors regardless of
background.

Alternatives:

- `outline=lighter` — auto-relative lighter shade. Rarely useful on
  light fills, but valid for darker fills if those ever come up.
- A single dark hex like `0d1117` (GitHub dark bg) or `1e293b`
  (slate-800) — uniform dark frame across all stamps. Less adaptive
  than `darker`.
- `outline=ffffff` — **avoid by default.** Only use when the body
  uses dark fills (Tailwind 600+) and the white halo provides
  necessary contrast. With the default 300–400 fills this is a
  readability bug.

Skip outline when:

- The user explicitly asks for plain stamps (no halo).
- Body is apology / postmortem / security — the visual lift
  contradicts the somber tone.
- Single-stamp comments (review reply with one action badge); the
  outline overhead doesn't justify a halo on a one-off.

When delegating to `mojiemoji-selector`, pass outline preference in
`CONSTRAINTS`:

```
- Add outline=darker outline_width=2 to every URL (dark-mode polish; never outline=ffffff with light Tailwind 300–400 fills)
```

## When parameters stop working

Mojiemoji's public API evolves — animation names, fonts, and query
keys can be added, renamed, or removed without notice. If a rendered
URL produces a parameter error, a broken image, or an obviously wrong
result, **the spec has likely drifted**. Do this before retrying:

1. Fetch the live docs from `https://mojiemoji.jozo.beer` (the home
   page exposes the parameter UI and accepted values; check for a
   `/docs`, `/help`, or `/about` page if linked).
2. Compare the live parameter list against `presets.md` (font roles,
   animation list, speed values) and the `--font` / `--animation` /
   `--speed` flags in `scripts/mojiemoji_markdown.rb`.
3. Update whichever of these has drifted:
   - `presets.md` — preset table, animation/font/speed lists
   - `scripts/mojiemoji_markdown.rb` — flag validation if it rejects
     a now-valid value
   - `SKILL.md` Defaults — if a recommended preset name changed
   - `parameters.md` (this file) — animation/font/color lists
4. Re-render with the corrected parameter and continue the task.

Do not silently swap to a "close enough" parameter without updating
the docs — the next session will hit the same error. Treat parameter
errors as a signal to refresh the spec, not a one-off retry.
