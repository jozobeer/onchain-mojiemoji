import type { Contract } from "ethers"

// EIP-3860 caps init code at 49152 bytes (post-Shanghai mainnet), so the full
// 2243-word vocabulary cannot be passed to `Dictionary.initialize(bytes[])` in
// a single deployment transaction. The mainnet-realistic seed protocol is:
//
//   1. deploy with `initialize([])` — empty Dictionary
//   2. `addWords(chunk_1) ... addWords(chunk_N)` sequentially
//   3. `freeze()` once the vocabulary is locked in (ADR-0003)
//
// This module implements the orchestration for step 2.

export const DEFAULT_CHUNK_SIZE = 200

export type SeedResult = {
    chunksSubmitted: number
    chunkGasUsed: bigint[]
}

export type SeedOptions = {
    chunkSize?: number
}

export const chunkWords = (words: Uint8Array[], chunkSize: number): Uint8Array[][] => {
    if (chunkSize <= 0) throw new Error(`chunkSize must be positive, got ${chunkSize}`)
    if (words.length === 0) return []
    return Array.from({ length: Math.ceil(words.length / chunkSize) }, (_, i) =>
        words.slice(i * chunkSize, (i + 1) * chunkSize),
    )
}

export const seedDictionary = async (
    dict: Contract,
    words: Uint8Array[],
    opts: SeedOptions = {},
): Promise<SeedResult> => {
    const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE
    const chunks = chunkWords(words, chunkSize)

    // Sequential reduce — addWords mutates contract state, so each tx must be
    // mined before the next is sent to keep ordering deterministic and avoid
    // nonce/state races. Push into a mutable accumulator inside the reduce
    // scope (Swift `reduce(into:)` equivalent — explicitly allowed by
    // .claude/rules/code-philosophy.md as the performance exception) to avoid
    // O(n^2) array copies as the chunk count grows.
    const chunkGasUsed = await chunks.reduce<Promise<bigint[]>>(async (accP, chunk) => {
        const acc = await accP
        const tx = await dict.addWords(chunk)
        const receipt = await tx.wait()
        if (receipt === null) throw new Error("addWords transaction receipt was null")
        acc.push(receipt.gasUsed as bigint)
        return acc
    }, Promise.resolve([]))

    return { chunksSubmitted: chunks.length, chunkGasUsed }
}
