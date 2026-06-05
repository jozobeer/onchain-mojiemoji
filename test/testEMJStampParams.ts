import { expect } from "chai"
import { Contract, toUtf8Bytes } from "ethers"
import { ethers, upgrades } from "hardhat"
import { describe, it } from "mocha"

import { LatestEMJ, latestEMJFactory } from "../libraries/const"
import {
    ANIMATIONS,
    COLORS,
    FONTS,
    SPEEDS,
    StampParams,
    deriveStampParams,
    stampImageUrl,
} from "../libraries/stampParams"
import { decodeTokenMetadata } from "./helpers/metadata"

// ADR-0005: tokenURI's `image` URL carries four Param values
// (font / color / animation / speed) derived deterministically from
// `keccak256(abi.encode("EMJ_PARAM_V1", tokenId))` via power-of-two bit masks.
// This suite verifies the derivation against an INDEPENDENT TypeScript oracle
// (libraries/stampParams.ts) — determinism, Dictionary-independence, candidate
// membership, and a pinned concrete sample. Word selection (which Japanese word)
// is unchanged from ADR-0002 and lives in testEMJTokenURIDictionary.ts.

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

const deployEMJWithDict = async (words: string[]): Promise<LatestEMJ> => {
    const dict = await deployDictionary(words.map(word))
    const emj = await deployEMJ()
    await emj.setMintLimit(1000)
    await emj.setDictionary(await dict.getAddress())
    return emj
}

// Extract the four Param values from a token image URL's query string.
const paramsOf = (image: string): StampParams => {
    const q = new URL(image).searchParams
    return {
        font: q.get("font") ?? "",
        color: q.get("color") ?? "",
        animation: q.get("animation") ?? "",
        speed: q.get("speed") ?? "",
    }
}

const imageOf = async (emj: LatestEMJ, tokenId: number | bigint): Promise<string> =>
    decodeTokenMetadata(await emj.tokenURI(tokenId)).image

describe("EMJ Stamp Params (ADR-0005 hash derivation)", () => {
    describe("Candidate set integrity (spec data invariants)", () => {
        it("font set has 16 unique values", () => {
            expect(FONTS).to.have.length(16)
            expect(new Set(FONTS).size).to.equal(16)
        })

        it("color set has 64 unique values", () => {
            expect(COLORS).to.have.length(64)
            expect(new Set(COLORS).size).to.equal(64)
        })

        it("animation set has 32 unique values", () => {
            expect(ANIMATIONS).to.have.length(32)
            expect(new Set(ANIMATIONS).size).to.equal(32)
        })

        it("speed set has 4 unique values", () => {
            expect(SPEEDS).to.have.length(4)
            expect(new Set(SPEEDS).size).to.equal(4)
        })

        it("the four sets yield 131,072 Param combinations", () => {
            expect(FONTS.length * COLORS.length * ANIMATIONS.length * SPEEDS.length).to.equal(131072)
        })
    })

    describe("URL shape (ADR-0005 D1: /emoji/ path form)", () => {
        it("image URL uses the /emoji/ path form, not the ?text= query form", async () => {
            const emj = await deployEMJWithDict(["焼く"])
            await emj.adminMint(1)
            const image = await imageOf(emj, 1)
            expect(image).to.match(/^https:\/\/mojiemoji\.jozo\.beer\/emoji\//)
            expect(image).to.not.contain("?text=")
        })

        it("carries exactly font, color, animation, speed query params (no text param)", async () => {
            const emj = await deployEMJWithDict(["焼く"])
            await emj.adminMint(1)
            const q = new URL(await imageOf(emj, 1)).searchParams
            expect([...q.keys()].sort()).to.deep.equal(["animation", "color", "font", "speed"])
            expect(q.get("text")).to.equal(null)
        })

        it("places the word in the percent-encoded path segment", async () => {
            const emj = await deployEMJWithDict(["焼く"])
            await emj.adminMint(1)
            const u = new URL(await imageOf(emj, 1))
            const segment = u.pathname.slice("/emoji/".length)
            expect(decodeURIComponent(segment)).to.equal("焼く")
        })
    })

    describe("Derivation matches the independent oracle", () => {
        it("token #1 image URL equals the oracle's stampImageUrl", async () => {
            const emj = await deployEMJWithDict(["焼く"])
            await emj.adminMint(1)
            expect(await imageOf(emj, 1)).to.equal(stampImageUrl("焼く", 1))
        })

        it("pins token #1 to a concrete Param sample (regression anchor)", async () => {
            const emj = await deployEMJWithDict(["焼く"])
            await emj.adminMint(1)
            expect(paramsOf(await imageOf(emj, 1))).to.deep.equal({
                font: "gothic-bold",
                color: "3665f2",
                animation: "kaiten",
                speed: "normal",
            })
        })

        it("matches the oracle across a spread of tokenIds (1..24)", async () => {
            const emj = await deployEMJWithDict(["焼く", "勝った", "光る"])
            await emj.adminMint(24)
            const ids = Array.from({ length: 24 }, (_, i) => i + 1)
            const images = await Promise.all(ids.map((id) => imageOf(emj, id)))
            ids.forEach((id, i) => {
                expect(paramsOf(images[i]), `token #${id}`).to.deep.equal(deriveStampParams(id))
            })
        })
    })

    describe("Each Param is always drawn from its candidate set", () => {
        it("derived font/color/animation/speed are members of the canonical sets", async () => {
            const emj = await deployEMJWithDict(["焼く", "勝った", "光る"])
            await emj.adminMint(24)
            const ids = Array.from({ length: 24 }, (_, i) => i + 1)
            const images = await Promise.all(ids.map((id) => imageOf(emj, id)))
            images.forEach((image, i) => {
                const p = paramsOf(image)
                const ctx = `token #${ids[i]}`
                expect(FONTS as readonly string[], ctx).to.include(p.font)
                expect(COLORS as readonly string[], ctx).to.include(p.color)
                expect(ANIMATIONS as readonly string[], ctx).to.include(p.animation)
                expect(SPEEDS as readonly string[], ctx).to.include(p.speed)
            })
        })
    })

    describe("Determinism & Dictionary-independence (domain separation)", () => {
        it("returns identical Params across repeated tokenURI calls", async () => {
            const emj = await deployEMJWithDict(["焼く", "勝った", "光る"])
            await emj.adminMint(1)
            expect(paramsOf(await imageOf(emj, 1))).to.deep.equal(paramsOf(await imageOf(emj, 1)))
        })

        it("derives the same Params for a tokenId regardless of Dictionary contents", async () => {
            // Two EMJ instances, same tokenId, different dictionaries of different
            // sizes. The Params depend only on tokenId (salted hash), so they must
            // be identical even though the chosen word differs.
            const emjA = await deployEMJWithDict(["焼く"])
            await emjA.adminMint(1)
            const emjB = await deployEMJWithDict(["AAA", "BBB", "CCC", "DDD", "EEE"])
            await emjB.adminMint(1)

            const a = paramsOf(await imageOf(emjA, 1))
            const b = paramsOf(await imageOf(emjB, 1))
            expect(a).to.deep.equal(b)
            expect(a).to.deep.equal(deriveStampParams(1))
        })
    })
})
