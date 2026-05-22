import { expect } from "chai"
import { BytesLike, Contract, ZeroAddress, hexlify, keccak256, AbiCoder, toUtf8Bytes } from "ethers"
import { ethers, upgrades } from "hardhat"
import { describe, it } from "mocha"

import { LatestEMJ, latestEMJFactory } from "../libraries/const"
import { decodeTokenMetadata } from "./testEMJTokenURIMetadata"

// Helpers --------------------------------------------------------------------

const word = (s: string): Uint8Array => toUtf8Bytes(s)
const asHex = (bytes: BytesLike): string => hexlify(bytes)

const BASE_URL = "https://mojiemoji.jozo.beer/?text="

// RFC 3986 percent-encode — mirrors EMJ.sol's _percentEncode (uppercase hex,
// unreserved = [A-Za-z0-9\-._~] pass through). JS encodeURIComponent diverges
// on `!'()*` (it treats them as unreserved), so we re-implement the rule here
// to keep the oracle byte-exact with the on-chain encoder.
const percentEncode = (text: string): string => {
    const bytes = toUtf8Bytes(text)
    const isUnreserved = (b: number): boolean =>
        (b >= 0x30 && b <= 0x39) ||
        (b >= 0x41 && b <= 0x5a) ||
        (b >= 0x61 && b <= 0x7a) ||
        b === 0x2d ||
        b === 0x2e ||
        b === 0x5f ||
        b === 0x7e
    return Array.from(bytes)
        .map((b) => (isUnreserved(b) ? String.fromCharCode(b) : `%${b.toString(16).toUpperCase().padStart(2, "0")}`))
        .join("")
}
const expectedUrlForWord = (w: string): string => `${BASE_URL}${percentEncode(w)}`

// ADR-0004: tokenURI returns base64-encoded JSON. This suite verifies the
// Dictionary-derivation rules (which word is chosen, snapshot semantics,
// aliasing) by extracting the `image` field from the decoded metadata and
// comparing against the expected mojiemoji URL. Pure JSON structure
// assertions live in testEMJTokenURIMetadata.ts.
const imageOf = async (emj: LatestEMJ, tokenId: number | bigint): Promise<string> =>
    decodeTokenMetadata(await emj.tokenURI(tokenId)).image

const deployDictionary = async (initialWords: Uint8Array[]): Promise<Contract> => {
    const factory = await ethers.getContractFactory("Dictionary")
    const proxy = await upgrades.deployProxy(factory, [initialWords], { kind: "uups" })
    return proxy as unknown as Contract
}

const deployEMJ = async (): Promise<LatestEMJ> => {
    const factory = await latestEMJFactory
    return (await upgrades.deployProxy(factory)) as LatestEMJ
}

// Prepare an EMJ instance wired to a Dictionary of the given words, with a generous mintLimit.
const deployEMJWithDict = async (words: string[]): Promise<{ emj: LatestEMJ; dict: Contract }> => {
    const dict = await deployDictionary(words.map(word))
    const emj = await deployEMJ()
    await emj.setMintLimit(1000)
    await emj.setDictionary(await dict.getAddress())
    return { emj, dict }
}

// Compute the expected derived word for a tokenId given snapshot range.
const expectedWord = (words: string[], tokenId: number, range: number): string => {
    const hash = keccak256(AbiCoder.defaultAbiCoder().encode(["uint256"], [tokenId]))
    const idx = BigInt(hash) % BigInt(range)
    return words[Number(idx)]
}

// ----------------------------------------------------------------------------

describe("EMJ TokenURI (Dictionary-derived image URL)", () => {
    describe("Dictionary Reference (setDictionary)", () => {
        it("Returns zero address before setDictionary is called", async () => {
            const emj = await deployEMJ()
            expect(await emj.dictionary()).to.equal(ZeroAddress)
        })

        it("Reflects the address set via setDictionary and supports re-pointing", async () => {
            const emj = await deployEMJ()
            const dict1 = await deployDictionary([word("焼く")])
            const dict2 = await deployDictionary([word("勝った")])

            await emj.setDictionary(await dict1.getAddress())
            expect(await emj.dictionary()).to.equal(await dict1.getAddress())

            await emj.setDictionary(await dict2.getAddress())
            expect(await emj.dictionary()).to.equal(await dict2.getAddress())
        })

        it("Reverts when a non-owner calls setDictionary", async () => {
            const [, alice] = await ethers.getSigners()
            const emj = await deployEMJ()
            const dict = await deployDictionary([word("焼く")])

            await expect(emj.connect(alice).setDictionary(await dict.getAddress())).to.be.revertedWith(
                "Ownable: caller is not the owner",
            )
        })
    })

    describe("Removed API (setStampText is gone)", () => {
        it("Does not expose setStampText in the ABI", async () => {
            const emj = await deployEMJ()
            expect(emj.interface.hasFunction("setStampText")).to.equal(false)
        })
    })

    describe("tokenURI image URL — happy path", () => {
        it("Image is mojiemoji URL for the single word in a 1-word Dictionary", async () => {
            const { emj } = await deployEMJWithDict(["勝った"])
            await emj.adminMint(1)
            expect(await imageOf(emj, 1)).to.equal(expectedUrlForWord("勝った"))
        })

        it("Picks one word deterministically via keccak256(abi.encode(tokenId)) % range", async () => {
            const words = ["焼く", "勝った", "光る"]
            const { emj } = await deployEMJWithDict(words)
            await emj.adminMint(1)

            const expected = expectedWord(words, 1, words.length)
            expect(await imageOf(emj, 1)).to.equal(expectedUrlForWord(expected))
        })

        it("Returns the same URL across repeated tokenURI calls for the same tokenId", async () => {
            const { emj } = await deployEMJWithDict(["焼く", "勝った", "光る"])
            await emj.adminMint(1)

            const first = await imageOf(emj, 1)
            const second = await imageOf(emj, 1)
            expect(first).to.equal(second)
        })

        it("Reverts tokenURI for a non-existent tokenId", async () => {
            const { emj } = await deployEMJWithDict(["焼く"])
            await emj.adminMint(1)
            await expect(emj.tokenURI(99)).to.be.revertedWith("tokenId not exist")
        })

        it("Reverts tokenURI for a burned tokenId", async () => {
            const { emj } = await deployEMJWithDict(["焼く"])
            await emj.adminMint(1)
            await emj.burn(1)
            await expect(emj.tokenURI(1)).to.be.revertedWith("tokenId not exist")
        })
    })

    describe("Snapshot at Batch Mint", () => {
        it("Writes snapshot only once per batch (quantity=10 → 1 SSTORE)", async () => {
            const { emj, dict } = await deployEMJWithDict(["焼く", "勝った", "光る"])
            await emj.adminMint(10)

            // All 10 tokens share the batch start (tokenId 1) snapshot. We assert this
            // indirectly: tokenURI for the batch-start and a mid-batch token both
            // resolve against the same wordCount snapshot (3).
            const dictCount: bigint = await dict.wordCount()
            expect(dictCount).to.equal(3n)
            const samples = [1, 5, 10]
            const images = await Promise.all(samples.map((id) => imageOf(emj, id)))
            samples.forEach((id, i) => {
                const expected = expectedWord(["焼く", "勝った", "光る"], id, 3)
                expect(images[i]).to.equal(expectedUrlForWord(expected))
            })
        })

        it("Assigns independent snapshots to separate batches", async () => {
            const words = ["焼く", "勝った", "光る"]
            const { emj, dict } = await deployEMJWithDict(words)
            await emj.adminMint(3) // batch 1: snapshot range = 3

            await dict.addWords([word("夢を見る"), word("祈る")])
            await emj.adminMint(2) // batch 2: snapshot range = 5

            const extended = [...words, "夢を見る", "祈る"]
            // Batch 1 tokens see range 3
            expect(await imageOf(emj, 1)).to.equal(expectedUrlForWord(expectedWord(words, 1, 3)))
            expect(await imageOf(emj, 3)).to.equal(expectedUrlForWord(expectedWord(words, 3, 3)))
            // Batch 2 tokens see range 5
            expect(await imageOf(emj, 4)).to.equal(expectedUrlForWord(expectedWord(extended, 4, 5)))
            expect(await imageOf(emj, 5)).to.equal(expectedUrlForWord(expectedWord(extended, 5, 5)))
        })

        it("Keeps existing tokens' tokenURI unchanged after Dictionary.addWords", async () => {
            const { emj, dict } = await deployEMJWithDict(["焼く", "勝った", "光る"])
            await emj.adminMint(1)
            const before = await emj.tokenURI(1)

            await dict.addWords([word("夢を見る"), word("祈る"), word("育てる")])
            const after = await emj.tokenURI(1)

            expect(after).to.equal(before)
        })

        it("Lets newly-minted tokens see the extended Dictionary range", async () => {
            const words = ["焼く"]
            const { emj, dict } = await deployEMJWithDict(words)
            await emj.adminMint(1) // batch 1: range = 1, image for token 1 = "焼く"
            expect(await imageOf(emj, 1)).to.equal(expectedUrlForWord("焼く"))

            await dict.addWords([word("勝った"), word("光る")])
            await emj.adminMint(1) // batch 2: range = 3

            const extended = ["焼く", "勝った", "光る"]
            const expected = expectedWord(extended, 2, 3)
            expect(await imageOf(emj, 2)).to.equal(expectedUrlForWord(expected))
        })
    })

    describe("Empty Dictionary Boundary", () => {
        it("Reverts mint when Dictionary wordCount is 0", async () => {
            const dict = await deployDictionary([])
            const emj = await deployEMJ()
            await emj.setMintLimit(10)
            await emj.setDictionary(await dict.getAddress())
            await expect(emj.adminMint(1)).to.be.reverted
        })

        it("Reverts mint when dictionary is not set (zero address)", async () => {
            const emj = await deployEMJ()
            await emj.setMintLimit(10)
            await expect(emj.adminMint(1)).to.be.reverted
        })

        it("Succeeds after Dictionary grows from empty to size 1 via addWords", async () => {
            const dict = await deployDictionary([])
            const emj = await deployEMJ()
            await emj.setMintLimit(10)
            await emj.setDictionary(await dict.getAddress())

            await dict.addWords([word("焼く")])
            await expect(emj.adminMint(1)).to.not.be.reverted
            expect(await imageOf(emj, 1)).to.equal(expectedUrlForWord("焼く"))
        })
    })

    describe("Dictionary Re-pointing (aliasing)", () => {
        it("New mints after setDictionary use the new dictionary's wordCount as snapshot range", async () => {
            const { emj } = await deployEMJWithDict(["焼く"])
            await emj.adminMint(1) // batch 1: snapshot = 1

            const dict2 = await deployDictionary([word("A"), word("B"), word("C"), word("D"), word("E")])
            await emj.setDictionary(await dict2.getAddress())
            await emj.adminMint(1) // batch 2: snapshot = 5 (new dict)

            const expected = expectedWord(["A", "B", "C", "D", "E"], 2, 5)
            expect(await imageOf(emj, 2)).to.equal(expectedUrlForWord(expected))
        })

        it("Existing tokens' tokenURI aliases to new dictionary's wordAt(old_index)", async () => {
            const oldWords = ["焼く", "勝った", "光る"]
            const { emj } = await deployEMJWithDict(oldWords)
            await emj.adminMint(1)

            // For tokenId=1, old index resolves against the snapshot of 3.
            const oldIndex = Number(BigInt(keccak256(AbiCoder.defaultAbiCoder().encode(["uint256"], [1]))) % 3n)

            // New dictionary keeps the same shape (3 entries) but different words at those indices.
            const newWords = ["AAA", "BBB", "CCC"]
            const dict2 = await deployDictionary(newWords.map(word))
            await emj.setDictionary(await dict2.getAddress())

            expect(await imageOf(emj, 1)).to.equal(expectedUrlForWord(newWords[oldIndex]))
        })
    })

    describe("Percent-encoding Integration", () => {
        // Each case is its own it() to avoid a forEach-around-it pattern that the
        // shared n-plus-one lint flags as a false positive.

        it("Image is correctly percent-encoded URL for kanji-only word", async () => {
            const w = "勝った"
            const { emj } = await deployEMJWithDict([w])
            await emj.adminMint(1)
            expect(await imageOf(emj, 1)).to.equal(expectedUrlForWord(w))
        })

        it("Image is correctly percent-encoded URL for hiragana-only word", async () => {
            const w = "あいうえ"
            const { emj } = await deployEMJWithDict([w])
            await emj.adminMint(1)
            expect(await imageOf(emj, 1)).to.equal(expectedUrlForWord(w))
        })

        it("Image is correctly percent-encoded URL for kanji+hiragana mix", async () => {
            const w = "焼く"
            const { emj } = await deployEMJWithDict([w])
            await emj.adminMint(1)
            expect(await imageOf(emj, 1)).to.equal(expectedUrlForWord(w))
        })

        // Note: the previous "word with newline" case was retired in ADR-0004.
        // Raw control characters (\n / \t / etc.) inside a word would emit an
        // invalid JSON envelope (RFC 8259 forbids unescaped control chars in
        // strings). The contract trusts that sanitize.ts (the dictionary build
        // gate) rejects such inputs before they reach the Dictionary — see
        // ADR-0002 §6 ("contract is a dumb data store") and ADR-0004 § Cons.

        // _percentEncode treats !'()* as reserved (RFC 3986 strict), unlike JS
        // encodeURIComponent which leaves them bare. Pin the encoder behavior
        // so future divergence between the contract and the test oracle is
        // caught here.
        it("Percent-encodes RFC-3986 reserved sub-delims !'()*", async () => {
            const w = "a!b'c(d)e*f"
            const { emj } = await deployEMJWithDict([w])
            await emj.adminMint(1)
            const expected = `${BASE_URL}a%21b%27c%28d%29e%2Af`
            expect(expectedUrlForWord(w)).to.equal(expected)
            expect(await imageOf(emj, 1)).to.equal(expected)
        })
    })

    describe("Interaction with EMJ flows", () => {
        it("adminMint-minted token has a working tokenURI", async () => {
            const { emj } = await deployEMJWithDict(["焼く"])
            await emj.adminMint(1)
            expect(await imageOf(emj, 1)).to.equal(expectedUrlForWord("焼く"))
        })

        it("publicMint-minted token has a working tokenURI", async () => {
            const [, , alice] = await ethers.getSigners()
            const { emj } = await deployEMJWithDict(["焼く"])
            // publicMint is open by default in initialize (start=0, end=max).
            // The default publicMintPrice is 1 ether.
            await emj.connect(alice).publicMint(1, { value: ethers.parseEther("1") })
            expect(await imageOf(emj, 1)).to.equal(expectedUrlForWord("焼く"))
        })

        it("Preserves tokenURI across transferFrom (ownership-independent)", async () => {
            const [deployer, , bob] = await ethers.getSigners()
            const { emj } = await deployEMJWithDict(["焼く", "勝った", "光る"])
            await emj.adminMint(1)
            const before = await emj.tokenURI(1)

            await emj.transferFrom(deployer.address, bob.address, 1)
            const after = await emj.tokenURI(1)
            expect(after).to.equal(before)
        })

        it("Reverts tokenURI after burn (token no longer exists)", async () => {
            const { emj } = await deployEMJWithDict(["焼く"])
            await emj.adminMint(1)
            await emj.burn(1)
            await expect(emj.tokenURI(1)).to.be.revertedWith("tokenId not exist")
        })
    })
})

// Re-export the helper so it can be referenced from notes / tooling if needed.
export { asHex }
