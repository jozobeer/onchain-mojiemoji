import { expect } from "chai"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { Contract, getBytes } from "ethers"
import { ethers, upgrades } from "hardhat"
import { describe, it } from "mocha"

import { DEFAULT_CHUNK_SIZE, chunkWords, seedDictionary } from "../libraries/dictionarySeed"

// Issue #30: chunked seed deploy for Dictionary.
//
// Background: passing the full 2243-word vocabulary directly to
// `Dictionary.initialize(bytes[])` busts EIP-3860 init code max (49152
// bytes; mainnet enforces post-Shanghai). The mainnet-realistic deploy
// protocol therefore is:
//
//   1. deploy with `initialize([])` — empty Dictionary
//   2. `addWords(chunk_1) ... addWords(chunk_N)` sequentially
//   3. `freeze()` once the vocabulary is locked in (ADR-0003)
//
// These tests are the **executable specification** of that protocol.
// They exercise the FULL `data/initial-words.json` so the EIP-3860
// boundary is hit for real, not approximated with a small fixture
// (advisor: a 32-word smoke test proves nothing about the failure
// the issue is fixing). Hardhat network enforces EIP-3860 at the
// JSON-RPC layer — that is what produces the Red on the
// single-shot path.

const INITIAL_WORDS_PATH = resolve(__dirname, "..", "data", "initial-words.json")

const loadFullVocabulary = (): Uint8Array[] => {
    const hex = JSON.parse(readFileSync(INITIAL_WORDS_PATH, "utf8")) as string[]
    return hex.map((h) => getBytes(h))
}

const deployEmptyDictionary = async (): Promise<Contract> => {
    const factory = await ethers.getContractFactory("Dictionary")
    const proxy = await upgrades.deployProxy(factory, [[]], { kind: "uups" })
    return proxy as unknown as Contract
}

describe("Dictionary chunked seed deploy (Issue #30 — EIP-3860 compliant)", () => {
    describe("EIP-3860 boundary — the original failure mode", () => {
        it("Rejects single-shot initialize with the full vocabulary (init code > 49152 bytes)", async () => {
            const factory = await ethers.getContractFactory("Dictionary")
            const allWords = loadFullVocabulary()
            // The actual error message from hardhat-network is
            // "InvalidArgumentsError: Trying to send a deployment transaction
            // whose init code length is <N>. The max length allowed by
            // EIP-3860 is 49152." Match loosely on identifying tokens so the
            // assertion survives wording tweaks in upstream versions.
            await expect(upgrades.deployProxy(factory, [allWords], { kind: "uups" })).to.be.rejectedWith(
                /init code|EIP-3860|49152/i,
            )
        }).timeout(30_000)
    })

    describe("Empty initialize — starting point of the chunked seed protocol", () => {
        it("Deploys successfully with initialize([])", async () => {
            const dict = await deployEmptyDictionary()
            expect(await dict.wordCount()).to.equal(0n)
        })

        it("Caller becomes owner and can subsequently call addWords", async () => {
            const dict = await deployEmptyDictionary()
            const [owner] = await ethers.getSigners()
            expect(await dict.owner()).to.equal(owner.address)
            await dict.addWords([getBytes("0xe784bc")])
            expect(await dict.wordCount()).to.equal(1n)
        })
    })

    describe("chunkWords — pure splitting helper", () => {
        it("Splits N words into ceil(N / chunkSize) chunks", () => {
            const words = Array.from({ length: 7 }, (_, i) => getBytes(`0x0${i + 1}`))
            const chunks = chunkWords(words, 3)
            expect(chunks).to.have.length(3)
            expect(chunks[0]).to.have.length(3)
            expect(chunks[1]).to.have.length(3)
            expect(chunks[2]).to.have.length(1)
        })

        it("Preserves order across chunk boundaries", () => {
            const words = Array.from({ length: 5 }, (_, i) => getBytes(`0x0${i + 1}`))
            const chunks = chunkWords(words, 2)
            const flattened = chunks.flat()
            flattened.forEach((w, i) => {
                expect(Buffer.from(w).equals(Buffer.from(words[i]))).to.equal(true)
            })
        })

        it("Returns an empty list when given an empty input", () => {
            expect(chunkWords([], 100)).to.deep.equal([])
        })

        it("Rejects non-positive chunk size", () => {
            expect(() => chunkWords([getBytes("0x01")], 0)).to.throw(/chunkSize/i)
        })

        it("DEFAULT_CHUNK_SIZE is within the operational sweet spot (>=100, <=500)", () => {
            // Small enough that each addWords tx fits under block gas limit,
            // large enough that the full 2243-word seed completes in a
            // reasonable number of transactions (~20 or fewer).
            expect(DEFAULT_CHUNK_SIZE).to.be.gte(100)
            expect(DEFAULT_CHUNK_SIZE).to.be.lte(500)
        })
    })

    describe("seedDictionary — the chunked seed protocol", () => {
        it("Submits ceil(N / DEFAULT_CHUNK_SIZE) addWords transactions for the full vocabulary", async () => {
            const dict = await deployEmptyDictionary()
            const allWords = loadFullVocabulary()
            const result = await seedDictionary(dict, allWords)
            expect(result.chunksSubmitted).to.equal(Math.ceil(allWords.length / DEFAULT_CHUNK_SIZE))
        }).timeout(120_000)

        it("Final wordCount equals the input vocabulary size", async () => {
            const dict = await deployEmptyDictionary()
            const allWords = loadFullVocabulary()
            await seedDictionary(dict, allWords)
            expect(await dict.wordCount()).to.equal(BigInt(allWords.length))
        }).timeout(120_000)

        it("Each chunked addWords tx uses less than block gas limit (30M)", async () => {
            const dict = await deployEmptyDictionary()
            const allWords = loadFullVocabulary()
            const result = await seedDictionary(dict, allWords)
            const blockGasLimit = 30_000_000n
            result.chunkGasUsed.forEach((gas, idx) => {
                expect(gas, `chunk ${idx} gas=${gas} exceeded ${blockGasLimit}`).to.be.lessThan(blockGasLimit)
            })
        }).timeout(120_000)

        it("Is a no-op for an empty vocabulary", async () => {
            const dict = await deployEmptyDictionary()
            const result = await seedDictionary(dict, [])
            expect(result.chunksSubmitted).to.equal(0)
            expect(await dict.wordCount()).to.equal(0n)
        })
    })

    describe("Round-trip — chunked seed preserves on-chain state byte-for-byte", () => {
        it("wordAt(i) returns the input bytes at boundary indices (first / chunk boundaries / last)", async () => {
            const dict = await deployEmptyDictionary()
            const allWords = loadFullVocabulary()
            await seedDictionary(dict, allWords)
            const last = allWords.length - 1
            const probes = [
                0,
                DEFAULT_CHUNK_SIZE - 1, // last word of chunk 0
                DEFAULT_CHUNK_SIZE, // first word of chunk 1
                DEFAULT_CHUNK_SIZE * 2 - 1,
                DEFAULT_CHUNK_SIZE * 2,
                Math.floor(allWords.length / 2),
                last - 1,
                last,
            ].filter((i) => i >= 0 && i < allWords.length)
            // Sequential awaits on a single view function with a small probe
            // set — not a real N+1 (deterministic boundary sample, no
            // batchable DB analog). Keeping sequential keeps failures
            // attributable to a specific index in the assertion message.
            for (const i of probes) {
                const onChain = getBytes(await dict.wordAt(i))
                expect(
                    Buffer.from(onChain).equals(Buffer.from(allWords[i])),
                    `wordAt(${i}) mismatch`,
                ).to.equal(true)
            }
        }).timeout(120_000)
    })

    describe("freeze() after full chunked seed (ADR-0003 cross-cut)", () => {
        // ADR-0003 / Dictionary.sol NatSpec: freeze() seals upgrade authority
        // only — `addWords` and `transferOwnership` remain available
        // post-freeze. The cross-cut tests below pin both halves of that
        // invariant so any future refactor that conflates "frozen vocabulary"
        // with "frozen upgrades" breaks here loudly.

        it("addWords still works after freeze() (only upgrade authority is sealed)", async () => {
            const dict = await deployEmptyDictionary()
            const allWords = loadFullVocabulary()
            await seedDictionary(dict, allWords)
            await dict.freeze()
            // ADR-0003: mutation is intentionally NOT blocked by freeze().
            const before = (await dict.wordCount()) as bigint
            await dict.addWords([getBytes("0xe7849d")])
            expect(await dict.wordCount()).to.equal(before + 1n)
        }).timeout(120_000)

        it("wordAt remains queryable for the full range after freeze()", async () => {
            const dict = await deployEmptyDictionary()
            const allWords = loadFullVocabulary()
            await seedDictionary(dict, allWords)
            await dict.freeze()
            expect(await dict.wordCount()).to.equal(BigInt(allWords.length))
            const last = allWords.length - 1
            const onChain = getBytes(await dict.wordAt(last))
            expect(Buffer.from(onChain).equals(Buffer.from(allWords[last]))).to.equal(true)
        }).timeout(120_000)
    })
})
