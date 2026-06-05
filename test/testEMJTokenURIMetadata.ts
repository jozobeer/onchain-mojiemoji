import { expect } from "chai"
import { Contract, toUtf8Bytes } from "ethers"
import { ethers, upgrades } from "hardhat"
import { describe, it } from "mocha"

import { LatestEMJ, latestEMJFactory } from "../libraries/const"
import { decodeTokenMetadata } from "./helpers/metadata"

// ADR-0004: tokenURI returns `data:application/json;base64,<base64(JSON)>` where
// the decoded JSON is OpenSea-standard token metadata. Tests here lock the
// JSON STRUCTURE (name format, description presence, attributes shape).
// Dictionary-derivation / snapshot / aliasing behavior live in
// testEMJTokenURIDictionary.ts. The two suites verify orthogonal aspects of
// the same function: structure vs derivation.

const word = (s: string): Uint8Array => toUtf8Bytes(s)

const deployDictionary = async (initialWords: Uint8Array[]): Promise<Contract> => {
    const factory = await ethers.getContractFactory("Dictionary")
    const proxy = await upgrades.deployProxy(factory, [initialWords], { kind: "uups" })
    return proxy as unknown as Contract
}

const deployEMJ = async (): Promise<LatestEMJ> => {
    const factory = await latestEMJFactory
    return (await upgrades.deployProxy(factory)) as LatestEMJ
}

const deployEMJWithDict = async (words: string[]): Promise<{ emj: LatestEMJ; dict: Contract }> => {
    const dict = await deployDictionary(words.map(word))
    const emj = await deployEMJ()
    await emj.setMintLimit(1000)
    await emj.setDictionary(await dict.getAddress())
    return { emj, dict }
}

describe("EMJ TokenURI (OpenSea metadata structure)", () => {
    describe("Data URI envelope", () => {
        it("Returns a data:application/json;base64,... URI", async () => {
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(1)
            const uri = await emj.tokenURI(1)
            expect(uri).to.match(/^data:application\/json;base64,/)
        })

        it("Decoded payload is valid JSON", async () => {
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(1)
            const uri = await emj.tokenURI(1)
            // Should not throw.
            const meta = decodeTokenMetadata(uri)
            expect(meta).to.be.an("object")
        })
    })

    describe("JSON fields — required keys", () => {
        it("Includes name field with token-id-suffixed format", async () => {
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            expect(meta.name).to.equal("Onchain Mojiemoji #1")
        })

        it("Reflects tokenId in name across multiple tokens", async () => {
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(3)
            const m1 = decodeTokenMetadata(await emj.tokenURI(1))
            const m2 = decodeTokenMetadata(await emj.tokenURI(2))
            const m3 = decodeTokenMetadata(await emj.tokenURI(3))
            expect(m1.name).to.equal("Onchain Mojiemoji #1")
            expect(m2.name).to.equal("Onchain Mojiemoji #2")
            expect(m3.name).to.equal("Onchain Mojiemoji #3")
        })

        it("Includes a non-empty description field", async () => {
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            expect(meta.description).to.be.a("string")
            expect(meta.description.length).to.be.greaterThan(0)
        })

        it("Includes image field with mojiemoji.jozo.beer /emoji/ URL prefix (ADR-0005)", async () => {
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            expect(meta.image).to.match(/^https:\/\/mojiemoji\.jozo\.beer\/emoji\//)
        })
    })

    describe("Attributes field", () => {
        it("Includes attributes array with one entry", async () => {
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            expect(meta.attributes).to.be.an("array").with.length(1)
        })

        it("Attribute entry has trait_type 'word'", async () => {
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            expect(meta.attributes[0].trait_type).to.equal("word")
        })

        it("Attribute entry value matches the derived Japanese word", async () => {
            // 1-word dictionary makes the derivation deterministic to "勝った".
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            expect(meta.attributes[0].value).to.equal("勝った")
        })

        it("Attribute value contains raw (non-encoded) word — UTF-8 round-trip", async () => {
            // Verify the JSON contains the raw Japanese characters, not percent-encoded.
            const { emj } = await deployEMJWithDict(["焼く"])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            expect(meta.attributes[0].value).to.equal("焼く")
            // Image is percent-encoded so it differs from the attribute value.
            expect(meta.image).to.contain("%E7%84%BC%E3%81%8F")
        })
    })

    describe("Coherence between image and attributes", () => {
        it("image URL's path segment decodes to the same word as attribute value (ADR-0005)", async () => {
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            // ADR-0005: the word now lives in the /emoji/<word> path segment, not a ?text= query param.
            const segment = new URL(meta.image).pathname.slice("/emoji/".length)
            expect(decodeURIComponent(segment)).to.equal(meta.attributes[0].value)
        })
    })

    describe("JSON-unsafe word bytes (defensive escape)", () => {
        // Dictionary is a dumb data store (ADR-0002 §6) and setDictionary is
        // repointable, so the contract cannot trust off-chain sanitizers at
        // read time. _jsonEscape must round-trip raw bytes through the JSON
        // envelope cleanly. (Codex / Copilot P1 review on PR #29.)

        it("Escapes double-quote (0x22) so JSON parses and value round-trips", async () => {
            const w = 'has"quote'
            const { emj } = await deployEMJWithDict([w])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            expect(meta.attributes[0].value).to.equal(w)
        })

        it("Escapes backslash (0x5C) so JSON parses and value round-trips", async () => {
            const w = "has\\backslash"
            const { emj } = await deployEMJWithDict([w])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            expect(meta.attributes[0].value).to.equal(w)
        })

        it("Escapes newline (0x0A) so JSON parses and value round-trips", async () => {
            const w = "line1\nline2"
            const { emj } = await deployEMJWithDict([w])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            expect(meta.attributes[0].value).to.equal(w)
        })

        it("Escapes null byte (0x00) so JSON parses and value round-trips", async () => {
            const w = "before\x00after"
            const { emj } = await deployEMJWithDict([w])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            expect(meta.attributes[0].value).to.equal(w)
        })

        it("Passes through high-bit UTF-8 bytes unchanged (Japanese)", async () => {
            // UTF-8 continuation bytes (0x80-0xFF) are NOT control chars and
            // must not be escaped — JSON.parse decodes the UTF-8 sequence.
            const w = "焼く"
            const { emj } = await deployEMJWithDict([w])
            await emj.adminMint(1)
            const meta = decodeTokenMetadata(await emj.tokenURI(1))
            expect(meta.attributes[0].value).to.equal(w)
        })
    })

    describe("View function semantics preserved", () => {
        it("Reverts for non-existent token (same as before ADR-0004)", async () => {
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(1)
            await expect(emj.tokenURI(99)).to.be.revertedWith("tokenId not exist")
        })

        it("Reverts for burned token (same as before ADR-0004)", async () => {
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(1)
            await emj.burn(1)
            await expect(emj.tokenURI(1)).to.be.revertedWith("tokenId not exist")
        })

        it("Returns identical metadata for repeated calls (deterministic)", async () => {
            const { emj } = await deployEMJWithDict(["勝った", "焼く", "光る"])
            await emj.adminMint(1)
            const first = await emj.tokenURI(1)
            const second = await emj.tokenURI(1)
            expect(first).to.equal(second)
        })
    })
})
