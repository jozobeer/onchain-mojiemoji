import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { stderr } from "node:process"

import { sanitize, toHexBytes } from "./sanitize"

// Issue #26: data/initial-words.txt → sanitize → data/initial-words.json
//
// 役割 thin wrapper:
//   - txt をパース (# コメント / 空行は事前除去 — sanitize の reject log を
//     ノイズなしの「audit log」として扱えるようにする)
//   - sanitize に通す (Dictionary.initialize 引数互換の bytes[] を生成)
//   - 受理語の hex bytes を JSON 配列に書き出す
//   - 落ちた語と理由を stderr に出力 (deploy 前 audit 用)
//
// 出力 JSON は Dictionary.initialize にそのまま食わせる前提:
//   const initial = JSON.parse(readFileSync("data/initial-words.json", "utf8"))
//   await dict.initialize(initial.map((h) => getBytes(h)))

interface BuildStats {
    rawLineCount: number
    afterPreFilter: number
    accepted: number
    rejected: number
}

const PROJECT_ROOT = resolve(__dirname, "..", "..")
const INPUT_PATH = resolve(PROJECT_ROOT, "data/initial-words.txt")
const OUTPUT_PATH = resolve(PROJECT_ROOT, "data/initial-words.json")

const isCommentOrBlank = (line: string): boolean => {
    const trimmed = line.trim()
    return trimmed === "" || trimmed.startsWith("#")
}

const parseInputFile = (path: string): { raw: string[]; rawLineCount: number } => {
    const body = readFileSync(path, "utf8")
    const all = body.split(/\r?\n/)
    return { raw: all.filter((l) => !isCommentOrBlank(l)), rawLineCount: all.length }
}

const writeOutput = (path: string, hex: string[]): void => {
    writeFileSync(path, `${JSON.stringify(hex, null, 2)}\n`, "utf8")
}

const reportStats = (stats: BuildStats): void => {
    stderr.write(`---\n`)
    stderr.write(`raw lines:          ${stats.rawLineCount}\n`)
    stderr.write(`after pre-filter:   ${stats.afterPreFilter} (stripped # / blank)\n`)
    stderr.write(`accepted:           ${stats.accepted}\n`)
    stderr.write(`rejected:           ${stats.rejected}\n`)
}

export const buildInitial = (): BuildStats => {
    const { raw, rawLineCount } = parseInputFile(INPUT_PATH)
    const { sanitized, rejected } = sanitize(raw)
    rejected.forEach(({ word, reason }) => {
        stderr.write(`reject [${reason}]: ${JSON.stringify(word)}\n`)
    })
    const hex = toHexBytes(sanitized)
    writeOutput(OUTPUT_PATH, hex)
    const stats: BuildStats = {
        rawLineCount,
        afterPreFilter: raw.length,
        accepted: sanitized.length,
        rejected: rejected.length,
    }
    reportStats(stats)
    stderr.write(`output → ${OUTPUT_PATH}\n`)
    return stats
}

if (require.main === module) {
    buildInitial()
}
