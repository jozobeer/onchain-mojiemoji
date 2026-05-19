#!/usr/bin/env bash
# Generate an image via the Codex CLI's built-in image_gen tool (gpt-image-2).
# Bills against the user's existing ChatGPT Plus/Pro/Team subscription
# instead of charging the OpenAI API per image.
#
# Pre-flight: codex must be logged in via ChatGPT OAuth (not API key).
# Verify with:
#   codex login status   # expect: "Logged in using ChatGPT"
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: make-image.sh --out PATH --prompt "DESCRIPTION" [--size WxH] [--bill-api-key]

Required:
  --out PATH      Output image path (relative or absolute, .png).
  --prompt TEXT   Visual description of the image to generate.

Optional:
  --size WxH      Pixel dimensions (default: 1024x1024).
                  Constraints enforced before calling Codex:
                    - each side a multiple of 16
                    - max 3840 px per side
                    - aspect ratio <= 3:1
                    - total pixels in [655360, 8294400]
  --bill-api-key  Allow generation when codex is in API-key mode (NOT
                  ChatGPT OAuth). Without this flag, the script aborts
                  before invoking codex if OAuth mode isn't detected,
                  to avoid silently billing the user's OpenAI account
                  per image.

Example:
  make-image.sh \
    --out ./hero.png \
    --size 1536x1024 \
    --prompt "Aerial view of Tokyo at night, neon reflecting on wet asphalt"
EOF
}

out=""
size="1024x1024"
prompt=""
allow_api_key=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out) out="${2:-}"; shift 2 ;;
    --size) size="${2:-}"; shift 2 ;;
    --prompt) prompt="${2:-}"; shift 2 ;;
    --bill-api-key) allow_api_key=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -z "$out" ]] && { echo "Missing --out" >&2; usage >&2; exit 2; }
[[ -z "$prompt" ]] && { echo "Missing --prompt" >&2; usage >&2; exit 2; }

if [[ ! "$size" =~ ^([0-9]+)x([0-9]+)$ ]]; then
  echo "Invalid --size '$size' (expected WIDTHxHEIGHT, e.g. 1024x1024)" >&2
  exit 2
fi
width="${BASH_REMATCH[1]}"
height="${BASH_REMATCH[2]}"

for d in "$width" "$height"; do
  (( d % 16 == 0 )) || { echo "Each side must be a multiple of 16 (got $d)" >&2; exit 2; }
  (( d <= 3840 )) || { echo "Side length capped at 3840 px (got $d)" >&2; exit 2; }
  (( d >= 256 ))  || { echo "Side too small: $d (try 1024 or larger)" >&2; exit 2; }
done

total=$(( width * height ))
(( total >= 655360 ))  || { echo "Total pixels too small: $total (min 655,360 — try 1024x1024)" >&2; exit 2; }
(( total <= 8294400 )) || { echo "Total pixels too large: $total (max 8,294,400)" >&2; exit 2; }

# aspect ratio <= 3:1 in either orientation
if (( width > height * 3 || height > width * 3 )); then
  echo "Aspect ratio exceeds 3:1 (got ${width}:${height})" >&2
  exit 2
fi

# resolve absolute output path so codex --cd lands in the right place
out_dir=$(cd "$(dirname "$out")" 2>/dev/null && pwd) || {
  echo "Output directory does not exist: $(dirname "$out")" >&2
  exit 1
}
out_name=$(basename "$out")
out_abs="$out_dir/$out_name"

# pre-flight: codex must be installed AND logged in via ChatGPT OAuth.
# We distinguish three failure modes so the user gets accurate diagnostics:
#   (a) codex CLI missing entirely     → exit 4
#   (b) `codex login status` errors    → exit 5
#   (c) auth mode is not ChatGPT OAuth → exit 3 (or proceed if --bill-api-key)
# Without these distinctions, "ChatGPT not in output" was previously
# treated as "API-key mode" — but it could also mean the binary is missing
# or the status command crashed, in which case --bill-api-key would
# silently mask the real failure until `codex exec` later collapsed.
if ! command -v codex >/dev/null 2>&1; then
  echo "ERROR: 'codex' CLI not found in PATH. Install Codex first." >&2
  exit 4
fi

login_output=$(codex login status 2>&1) || login_rc=$?
login_rc=${login_rc:-0}

if (( login_rc != 0 )); then
  cat >&2 <<ERR
ERROR: 'codex login status' exited with status $login_rc.
Output:
$login_output

Cannot determine codex auth mode. Try: codex login

Aborting before invoking codex.
ERR
  exit 5
fi

if ! grep -q 'ChatGPT' <<<"$login_output"; then
  if [[ "$allow_api_key" -eq 1 ]]; then
    cat >&2 <<WARN
NOTE: --bill-api-key was passed and 'codex login status' did not report
ChatGPT OAuth. Proceeding under the assumption that codex is in API-key
mode. This image generation WILL bill the user's OpenAI account per image
(not the ChatGPT subscription).

'codex login status' said:
$login_output
WARN
  else
    cat >&2 <<ERR
ERROR: 'codex login status' did not report ChatGPT OAuth mode.
Output:
$login_output

Without ChatGPT OAuth, this command would bill the user's OpenAI account
per image (~\$0.04+) instead of using their ChatGPT subscription.

To proceed:
  1. Switch to ChatGPT OAuth (recommended):
       codex logout && codex login
     then re-run this command.
  2. OR explicitly opt in to API-key billing by re-running with
     --bill-api-key (you will be charged per image).

Aborting before invoking codex.
ERR
    exit 3
  fi
fi

# craft the instruction for Codex (English; Codex parses any language fine).
# Note: Codex's image_gen tool always saves to ~/.codex/generated_images/<session>/,
# regardless of where we ask. We copy from there to --out after the run.
read -r -d '' instruction <<EOF || true
Use Codex's built-in image_gen tool (gpt-image-2) directly to produce exactly
one image. Do NOT write any script. Do NOT use the OpenAI API key. Do NOT use
Python, the openai package, curl, or any other HTTP client. Just call the
built-in image_gen tool once.

Requested size: ${width}x${height}

Prompt:
${prompt}
EOF

# Capture stdout so we can parse the session id (image lands in
# ~/.codex/generated_images/<session-id>/, not where Codex's prompt asks).
log_file=$(mktemp -t make-image.XXXXXX)
trap 'rm -f "$log_file"' EXIT

# Redirect stdin from /dev/null so codex doesn't wait for piped input.
# `tee` mirrors output to the terminal so the user can watch progress.
codex exec \
  --dangerously-bypass-approvals-and-sandbox \
  --cd "$out_dir" \
  "$instruction" \
  </dev/null \
  | tee "$log_file"

# Locate the generated image. Strategy: parse the session id Codex prints,
# then look in its session directory.
# Codex emits ANSI escape codes around labels (e.g., "\e[1msession id:\e[0m UUID"),
# so strip those before pattern-matching, and match the UUID directly rather
# than relying on whitespace between "id:" and the value.
session_id=$(sed -E 's/\x1b\[[0-9;]*m//g' "$log_file" \
  | grep -m1 -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
  || true)

codex_img_root="${CODEX_HOME:-$HOME/.codex}/generated_images"
if [[ ! -d "$codex_img_root" ]]; then
  codex_img_root="$HOME/.config/codex/generated_images"
fi

found=""
if [[ -n "$session_id" && -d "$codex_img_root/$session_id" ]]; then
  # newest .png in that session dir
  found=$(ls -t "$codex_img_root/$session_id"/*.png 2>/dev/null | head -1)
fi

# fallback: newest .png across all session dirs (in case session id parse fails)
if [[ -z "$found" ]]; then
  found=$(find "$codex_img_root" -name '*.png' -type f -print0 2>/dev/null \
    | xargs -0 ls -t 2>/dev/null \
    | head -1)
fi

if [[ -z "$found" || ! -f "$found" ]]; then
  printf '\n✗ Could not locate the generated image.\n' >&2
  printf '  Looked under: %s\n' "$codex_img_root" >&2
  printf '  Session id parsed: %s\n' "${session_id:-<none>}" >&2
  exit 1
fi

# move into place
mv "$found" "$out_abs"

printf '\n✓ Image saved: %s\n' "$out_abs"
if command -v sips >/dev/null 2>&1; then
  dims=$(sips -g pixelWidth -g pixelHeight "$out_abs" 2>/dev/null \
    | awk '/pixel(Width|Height)/{print $2}' | xargs | tr ' ' 'x')
  bytes=$(stat -f%z "$out_abs" 2>/dev/null || stat -c%s "$out_abs" 2>/dev/null || echo '?')
  printf '  actual: %s, %s bytes (requested %sx%s)\n' \
    "${dims:-?}" "$bytes" "$width" "$height"
fi
