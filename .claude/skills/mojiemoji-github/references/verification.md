# Mojiemoji Verification & Service Constraints

Hard service limits and the post-dispatch verification block. Loaded
on demand from SKILL.md after receiving snippets from
`mojiemoji-selector` (or before pasting any hand-written URL).

## 15-character phrase cap

The `text` portion of the URL (between `/emoji/` and `?`) is capped
at **15 characters**, **including** the URL-encoded `%0A` (which
counts as 1 character). Going over returns HTTP 400 with body
`too many characters (max 15)` and the image fails to render.

Worked examples:

| Phrase (decoded) | Char count | Status |
|---|---|---|
| `5指標スキーマ` (7 chars) | 7 | ✅ OK |
| `cluster5\nsub-A 起点` (encoded `cluster5%0Asub-A%20起点`) | 16 (with `%0A`) | ✗ 400 |
| `レビュー歓迎` (5 chars) | 5 | ✅ OK |
| `この長い宣伝文を一気に` (12 chars) | 12 | ✅ OK |

If the phrase you want exceeds 15 chars:

- **Inline**: split into two adjacent stamps (see SKILL.md
  § Phrase-length & line-break rules)
- **Block**: choose a shorter phrase, or split into two stamps on
  consecutive lines (each its own `![...](...)`)

## Pre-flight verification

Before pasting a mojiemoji URL into a body, especially for new
phrases, confirm it returns HTTP 200:

```bash
curl -sI 'https://mojiemoji.jozo.beer/emoji/<encoded>?...' | head -2
```

200 = renderable. 400 = phrase exceeds 15 chars (or contains an
invalid character) — shorten and retry. The `mojiemoji-selector`
subagent should also include this in its self-check before returning
snippets.

## Post-dispatch spot-check (run on every returned body)

After receiving snippets, **spot-check every snippet** (not just the
first — the subagent has historically slipped on individual snippets
while the first looks fine). Run all of these against the full
returned body, not by eyeball:

```bash
# 1. Save the body for grep
SNIPPETS=/tmp/mojiemoji_snippets.txt
# (paste the returned table or full body here)

# 2. Every URL has background=transparent
grep -oE 'mojiemoji[^"<)]+' "$SNIPPETS" | grep -v 'background=transparent' && echo "✗ MISSING transparent"

# 3. Every URL has outline=darker (and outline_width=2)
grep -oE 'mojiemoji[^"<)]+' "$SNIPPETS" | grep -v 'outline=darker' && echo "✗ MISSING outline=darker"
grep -F 'outline=ffffff' "$SNIPPETS" && echo "✗ FORBIDDEN outline=ffffff"

# 4. Forbidden colors (Tailwind 600+ red/orange/blue/etc — never on dark mode)
grep -oE 'color=(dc2626|b91c1c|991b1b|c2410c|ca8a04|15803d|16a34a|0e7490|1d4ed8|2563eb|4338ca|7e22ce|be185d|000000|111827|1f2937)' "$SNIPPETS" && echo "✗ DARK COLOR — swap to 300–500 range"

# 5. Animation must be in canonical list (negative grep — flag anything else).
#    Extract the full value up to a URL/HTML delimiter (`&`, `"`, `<`, `>`,
#    `)`, space) so typos containing unexpected characters (e.g.,
#    `animation=foo-bar`) aren't silently truncated to a canonical-shaped
#    prefix and passed through. The negative match uses `-x` so the entire
#    extracted value must equal a canonical name (no prefix-only hits).
#    Canonical names contain underscores (tate_scroll, kage_kaiten, etc.).
grep -oE 'animation=[^"<>&) ]+' "$SNIPPETS" | grep -vxE 'animation=(tate_scroll|yoko_scroll|ekken|tate_ekken|bane|gatagata|bure|chuuou_zoom|kirari|kira|tenmetsu|shuchusen|kaiten|neruneru|patapata|yurayura|mabataki|bakusan|norinori|mochimochi|mozaiku|poyoon|yatta|tatemoya|nami|yokomoya|zairu|zanzo|chirichiri|disco|psycho|kage_kaiten|kage_bokashi|kage_neon)' && echo "✗ INVALID animation"

# 6. bakusan must not be inline (`<img` line indicates inline)
grep -E '<img[^>]+animation=bakusan' "$SNIPPETS" && echo "✗ bakusan in inline"

# 7. Inline: %0A is forbidden in URL text
grep -E '<img[^>]+/emoji/[^"]*%0A' "$SNIPPETS" && echo "✗ INLINE %0A — split into 2 stamps"

# 8. Phrase length ≤15 chars (including %0A). Decode each phrase and count.
python3 -c "
import re, urllib.parse, sys
content = open('$SNIPPETS').read()
for m in re.finditer(r'mojiemoji.jozo.beer/emoji/([^?]+)', content):
    decoded = urllib.parse.unquote(m.group(1))
    if len(decoded) > 15:
        print(f'✗ {len(decoded)} chars: {decoded}')
"

# 9. Latin chars in inline can also wrap. Each \"web UI\"-class phrase
#    should have been split — verify by running step 8 (length 5+ Latin
#    is suspect for inline).

# 10. Body-class block stamps — DEFAULT FORBIDDEN on PR / issue / release
#     bodies (see SKILL.md § Saturation Mode "Default mode = inline-only").
#     `![alt](https://mojiemoji.jozo.beer/...)` markdown form indicates a
#     block stamp. Should match zero lines unless the user explicitly
#     asked for block decoration this turn.
grep -E '^!\[[^]]*\]\(https://mojiemoji' "$SNIPPETS" && echo "✗ BLOCK STAMP — convert to inline <img> form"

# 11. Live URL check — every stamp must return HTTP 200 (catches
#     mis-encoded kanji and non-canonical phrase typos that grep can't see).
grep -oE 'https://mojiemoji\.jozo\.beer/[^"<)]+' "$SNIPPETS" | while read u; do
  code=$(curl -sI -o /dev/null -w "%{http_code}" "$u")
  [ "$code" = "200" ] || echo "✗ HTTP $code: $u"
done

# 12. Animation diversity — 12+ distinct values, none used more than 2× across body.
#     Updated from the historical 8/3× floor: with 33 canonical animations
#     available, 12+ distinct and ≤2× repetition is the new bar (see
#     parameters.md § Spread animation choices wide).
#     Failure mode this catches: issue #166 (15 stamps, all animation=bane).
grep -oE 'animation=[a-z_]+' "$SNIPPETS" | sort | uniq -c | sort -rn > /tmp/_anim_count
awk '$1 > 2 { print "✗ animation overused (>2×): " $2 " (" $1 "×)" }' /tmp/_anim_count
distinct_anim=$(grep -oE 'animation=[a-z_]+' "$SNIPPETS" | sort -u | wc -l | tr -d ' ')
[ "$distinct_anim" -lt 12 ] && echo "✗ animation diversity: only $distinct_anim distinct (want ≥12 across body)"

# 13. Color diversity — 4+ distinct hex values across body.
#     Failure mode this catches: issue #166 (15 stamps, all color=60a5fa).
distinct_color=$(grep -oE 'color=[0-9a-f]{6}' "$SNIPPETS" | sort -u | wc -l | tr -d ' ')
[ "$distinct_color" -lt 4 ] && echo "✗ color diversity: only $distinct_color distinct (want ≥4 across body)"

# 14. Do-not-stamp identifiers (API names, English single-word verdicts, code-shaped tokens).
#     Failure mode this catches: issue #166 (`Promise.all` and `Green` rendered as stamps).
python3 -c "
import re, urllib.parse
content = open('$SNIPPETS').read()
BAD = {'Promise.all','Promise','useState','useEffect','Map','Map.from','Vec::new',
       'Result','Option','Iterator::find','null','undefined','OK','NG','Yes','No',
       'True','False','Green','Red','Blue','Success','Error'}
for m in re.finditer(r'mojiemoji\.jozo\.beer/emoji/([^?]+)', content):
    text = urllib.parse.unquote(m.group(1)).split('%0A')[0]
    if text in BAD:
        print(f'✗ identifier stamp (forbidden term): {text}')
    elif re.match(r'^[A-Za-z][A-Za-z0-9._-]+\$', text):
        print(f'✗ identifier-shaped stamp (English/code): {text}')
    elif re.match(r'^[#v]\d', text):
        print(f'✗ issue/version-shaped stamp: {text}')
"
```

If any check fails, fix locally (or re-dispatch) before pasting into
the body. **Do not** ship a body with any of these issues — the user
will notice on the rendered PR and the recurring rework cost compounds.
