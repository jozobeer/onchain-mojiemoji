import { readFileSync, writeFileSync } from "node:fs"
import { argv, stderr } from "node:process"

import { hexlify, toUtf8Bytes } from "ethers"

// ADR-0002 §6: contract は dumb data store。validation / dedup / length-cap は
// すべてこの sanitizer の責務。Dictionary.initialize / addWords に食わせる
// bytes[] を構築する経路として、すべての raw 単語列がここを通過する前提。

export interface SanitizeOptions {
    /** 1 単語あたりの UTF-8 byte 上限。デフォルト 64。 */
    maxBytes: number
    /** true なら character-class チェックをスキップ。デフォルト false。 */
    allowNonJapanese: boolean
}

export type RejectReason = "empty" | "duplicate" | "too-long" | "non-japanese"

export interface SanitizeResult {
    /** validate を通過した単語列 (input order、dedup 済)。 */
    sanitized: string[]
    /** 落ちた単語と理由のリスト (input order)。 */
    rejected: Array<{ word: string; reason: RejectReason }>
}

const DEFAULT_OPTIONS: SanitizeOptions = {
    maxBytes: 64,
    allowNonJapanese: false,
}

// 文字種は「日本語の letter のみ」に限定する。カタカナ block の中で `・` (U+30FB)
// `゠` (U+30A0) のような punctuation、ひらがな block の `゛` `゜` (U+3099/309A)
// のような濁点記号は除外する — full block range で許容すると symbol-only token
// が non-japanese reject を擦り抜けるため (Codex review #25 P2)。
//   - U+3041-U+3096: ひらがな本体 (ぁ-ゖ)
//   - U+309D-U+309E: 繰り返し記号 ゝ ゞ
//   - U+30A1-U+30FA: カタカナ本体 (ァ-ヺ)
//   - U+30FC:         長音符 ー
//   - U+30FD-U+30FE: 繰り返し記号 ヽ ヾ
//   - U+4E00-U+9FFF: CJK 基本漢字
const JAPANESE_ONLY = /^[ぁ-ゖゝゞァ-ヺー-ヾ一-鿿]+$/

export const sanitize = (raw: string[], options: Partial<SanitizeOptions> = {}): SanitizeResult => {
    const opts: SanitizeOptions = { ...DEFAULT_OPTIONS, ...options }
    const seen = new Set<string>()
    const sanitized: string[] = []
    const rejected: SanitizeResult["rejected"] = []

    for (const original of raw) {
        const trimmed = original.trim()
        if (trimmed === "") {
            rejected.push({ word: original, reason: "empty" })
            continue
        }
        if (seen.has(trimmed)) {
            rejected.push({ word: trimmed, reason: "duplicate" })
            continue
        }
        // Record the post-trim form before further validation so that a second
        // occurrence of a word — even if the first was rejected for length /
        // char-class — is still classified as `duplicate` rather than getting
        // re-validated and re-rejected for the same downstream reason.
        seen.add(trimmed)
        if (toUtf8Bytes(trimmed).length > opts.maxBytes) {
            rejected.push({ word: trimmed, reason: "too-long" })
            continue
        }
        if (!opts.allowNonJapanese && !JAPANESE_ONLY.test(trimmed)) {
            rejected.push({ word: trimmed, reason: "non-japanese" })
            continue
        }
        sanitized.push(trimmed)
    }

    return { sanitized, rejected }
}

export const toHexBytes = (words: string[]): string[] => words.map((w) => hexlify(toUtf8Bytes(w)))

// ────────────────────────────────────────────────────────────────────────────
// CLI entry-point — runs only when invoked as a script, not when imported.
// Usage:
//   pnpm exec ts-node scripts/dictionary/sanitize.ts \
//       --in raw.txt --out sanitized.json [--max-bytes 64] [--allow-non-japanese]
// ────────────────────────────────────────────────────────────────────────────

interface CliArgs {
    inPath: string
    outPath: string
    maxBytes: number
    allowNonJapanese: boolean
}

const parseArgs = (args: string[]): CliArgs => {
    const get = (flag: string): string | undefined => {
        const idx = args.indexOf(flag)
        return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined
    }
    const inPath = get("--in")
    const outPath = get("--out")
    if (!inPath || !outPath) {
        throw new Error("usage: sanitize.ts --in <path> --out <path> [--max-bytes N] [--allow-non-japanese]")
    }
    const maxBytesRaw = get("--max-bytes")
    return {
        inPath,
        outPath,
        maxBytes: maxBytesRaw === undefined ? DEFAULT_OPTIONS.maxBytes : parsePositiveInt("--max-bytes", maxBytesRaw),
        allowNonJapanese: args.includes("--allow-non-japanese"),
    }
}

const parsePositiveInt = (flag: string, value: string): number => {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== value.trim()) {
        throw new Error(`${flag}: must be a positive integer, got ${JSON.stringify(value)}`)
    }
    return parsed
}

const readInput = (path: string): string[] => {
    const body = readFileSync(path, "utf8")
    if (!path.endsWith(".json")) return body.split(/\r?\n/)
    const parsed = JSON.parse(body)
    if (!Array.isArray(parsed)) throw new Error(`${path}: JSON root must be an array of strings`)
    parsed.forEach((el, i) => {
        if (typeof el !== "string") {
            throw new Error(`${path}: element at index ${i} is not a string (got ${typeof el})`)
        }
    })
    return parsed
}

export const runCli = (args: string[]): void => {
    const cli = parseArgs(args)
    const raw = readInput(cli.inPath)
    const result = sanitize(raw, { maxBytes: cli.maxBytes, allowNonJapanese: cli.allowNonJapanese })
    for (const { word, reason } of result.rejected) {
        stderr.write(`reject [${reason}]: ${JSON.stringify(word)}\n`)
    }
    const hex = toHexBytes(result.sanitized)
    writeFileSync(cli.outPath, `${JSON.stringify(hex, null, 2)}\n`, "utf8")
    stderr.write(`accepted=${result.sanitized.length} rejected=${result.rejected.length} → ${cli.outPath}\n`)
}

if (require.main === module) {
    runCli(argv.slice(2))
}
