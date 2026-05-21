import { expect } from "chai"
import { describe, it } from "mocha"

// Issue #24: Dictionary 用 TypeScript sanitizer の仕様。Dictionary.initialize /
// addWords に食わせる bytes[] を構築するための off-chain validation 経路。
// ADR-0002 §6: contract は dumb data store、validation / dedup / length-cap は
// すべて TypeScript の責務。

import { sanitize, toHexBytes } from "../scripts/dictionary/sanitize"

describe("Dictionary sanitizer", () => {
    describe("Normal behavior", () => {
        it("Passes through a single valid kanji+hiragana word", () => {
            const r = sanitize(["焼く"])
            expect(r.sanitized).to.deep.equal(["焼く"])
            expect(r.rejected).to.deep.equal([])
        })

        it("Preserves input order across multiple valid words", () => {
            const r = sanitize(["焼く", "勝った", "光る"])
            expect(r.sanitized).to.deep.equal(["焼く", "勝った", "光る"])
        })

        it("Accepts hiragana-only, katakana-only, kanji-only words", () => {
            const r = sanitize(["あいうえ", "アイウエ", "勝利"])
            expect(r.sanitized).to.deep.equal(["あいうえ", "アイウエ", "勝利"])
        })

        it("Accepts long-vowel mark (ー) embedded in katakana words", () => {
            const r = sanitize(["コーラ"])
            expect(r.sanitized).to.deep.equal(["コーラ"])
        })
    })

    describe("Trim and empty exclusion", () => {
        it("Trims leading/trailing whitespace before validation", () => {
            const r = sanitize(["  焼く  ", "\t勝った\n"])
            expect(r.sanitized).to.deep.equal(["焼く", "勝った"])
        })

        it("Excludes empty string after trim", () => {
            const r = sanitize(["", "   ", "焼く"])
            expect(r.sanitized).to.deep.equal(["焼く"])
            expect(r.rejected.map((x) => x.reason)).to.include("empty")
        })
    })

    describe("Deduplication", () => {
        it("Removes exact duplicates, preserving the first occurrence's index", () => {
            const r = sanitize(["焼く", "勝った", "焼く", "光る"])
            expect(r.sanitized).to.deep.equal(["焼く", "勝った", "光る"])
        })

        it("Considers post-trim values when deduplicating", () => {
            const r = sanitize(["焼く", "  焼く  "])
            expect(r.sanitized).to.deep.equal(["焼く"])
        })

        it("Tracks duplicates in the rejected list with reason `duplicate`", () => {
            const r = sanitize(["焼く", "焼く"])
            expect(r.rejected).to.have.lengthOf(1)
            expect(r.rejected[0].word).to.equal("焼く")
            expect(r.rejected[0].reason).to.equal("duplicate")
        })
    })

    describe("Max bytes constraint", () => {
        it("Defaults to 64 bytes as the per-word UTF-8 cap", () => {
            // 日本語 1 文字 = 3 bytes (BMP)。22 文字で 66 bytes。
            const longWord = "あ".repeat(22)
            const r = sanitize([longWord])
            expect(r.sanitized).to.deep.equal([])
            expect(r.rejected[0].reason).to.equal("too-long")
        })

        it("Honors a custom maxBytes option (lower bound)", () => {
            const r = sanitize(["焼く"], { maxBytes: 5 })
            // 「焼く」 = 6 bytes (3 + 3) > 5
            expect(r.sanitized).to.deep.equal([])
            expect(r.rejected[0].reason).to.equal("too-long")
        })

        it("Accepts a word exactly at the maxBytes boundary", () => {
            // 「焼く」 = 6 bytes
            const r = sanitize(["焼く"], { maxBytes: 6 })
            expect(r.sanitized).to.deep.equal(["焼く"])
        })
    })

    describe("Character class (Japanese-only by default)", () => {
        it("Rejects ASCII-containing words", () => {
            const r = sanitize(["焼くZ"])
            expect(r.sanitized).to.deep.equal([])
            expect(r.rejected[0].reason).to.equal("non-japanese")
        })

        it("Rejects emoji-containing words", () => {
            const r = sanitize(["焼く🔥"])
            expect(r.sanitized).to.deep.equal([])
            expect(r.rejected[0].reason).to.equal("non-japanese")
        })

        it("Rejects punctuation-only words", () => {
            const r = sanitize(["。"])
            expect(r.sanitized).to.deep.equal([])
            expect(r.rejected[0].reason).to.equal("non-japanese")
        })

        it("allowNonJapanese=true skips the character class check", () => {
            const r = sanitize(["焼くZ"], { allowNonJapanese: true })
            expect(r.sanitized).to.deep.equal(["焼くZ"])
        })
    })

    describe("Composite behavior", () => {
        it("Trim → dedup → length → char-class are applied in order with full audit trail", () => {
            const raw = ["  焼く  ", "焼く", "あ".repeat(22), "勝つZ", "勝った"]
            const r = sanitize(raw)
            expect(r.sanitized).to.deep.equal(["焼く", "勝った"])
            expect(r.rejected.map((x) => x.reason)).to.deep.equal(["duplicate", "too-long", "non-japanese"])
        })

        it("Returns an empty sanitized list when no input is given", () => {
            const r = sanitize([])
            expect(r.sanitized).to.deep.equal([])
            expect(r.rejected).to.deep.equal([])
        })
    })
})

describe("toHexBytes", () => {
    it("Returns lower-case 0x-prefixed hex per word, matching ethers.toUtf8Bytes", () => {
        const hex = toHexBytes(["焼く"])
        expect(hex).to.deep.equal(["0xe784bce3818f"])
    })

    it("Preserves order across multiple words", () => {
        const hex = toHexBytes(["焼く", "勝った", "光る"])
        expect(hex).to.have.lengthOf(3)
        expect(hex[0]).to.equal("0xe784bce3818f")
    })

    it("Returns an empty array for empty input", () => {
        expect(toHexBytes([])).to.deep.equal([])
    })
})
