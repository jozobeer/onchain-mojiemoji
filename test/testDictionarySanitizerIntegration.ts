import { expect } from "chai"
import { Contract, getBytes, hexlify } from "ethers"
import { ethers, upgrades } from "hardhat"
import { describe, it } from "mocha"

import { sanitize, toHexBytes } from "../scripts/dictionary/sanitize"

// Issue #24 acceptance criteria: sanitizer の出力 JSON が Dictionary.initialize
// にそのまま食わせられること。end-to-end の往復で word-level 同値性を確認する。

const deployDictionaryFromHex = async (hex: string[]): Promise<Contract> => {
    const factory = await ethers.getContractFactory("Dictionary")
    const initialBytes = hex.map((h) => getBytes(h))
    const proxy = await upgrades.deployProxy(factory, [initialBytes], { kind: "uups" })
    return proxy as unknown as Contract
}

describe("Dictionary sanitizer × Dictionary.initialize (integration)", () => {
    it("Round-trips raw words through sanitize → toHexBytes → initialize → wordAt", async () => {
        const raw = ["焼く", "勝った", "夢を見る", "光る"]
        const { sanitized } = sanitize(raw)
        const hex = toHexBytes(sanitized)
        const dict = await deployDictionaryFromHex(hex)

        expect(await dict.wordCount()).to.equal(BigInt(sanitized.length))
        const stored = await Promise.all(sanitized.map((_, i) => dict.wordAt(i)))
        expect(stored).to.deep.equal(hex)
    })

    it("Skips rejected words end-to-end (deduped / non-japanese / too-long never reach the contract)", async () => {
        const raw = ["焼く", "焼く", "勝つZ", "あ".repeat(22), "光る"]
        const { sanitized } = sanitize(raw)
        const hex = toHexBytes(sanitized)
        const dict = await deployDictionaryFromHex(hex)

        expect(await dict.wordCount()).to.equal(2n)
        expect(await dict.wordAt(0)).to.equal(hex[0])
        expect(await dict.wordAt(1)).to.equal(hex[1])
    })

    it("Output hex bytes round-trip via ethers.toUtf8String to the original word", async () => {
        const raw = ["焼く", "勝った"]
        const hex = toHexBytes(sanitize(raw).sanitized)
        const dict = await deployDictionaryFromHex(hex)

        const wordHex = await dict.wordAt(0)
        const restored = Buffer.from(getBytes(wordHex)).toString("utf8")
        expect(restored).to.equal("焼く")
        expect(hexlify(getBytes(wordHex))).to.equal(hex[0])
    })
})
