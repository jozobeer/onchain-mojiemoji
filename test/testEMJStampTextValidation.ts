import { expect } from 'chai'
import { encodeBytes32String, getBytes, hexlify, zeroPadBytes } from 'ethers'
import { ethers, upgrades } from 'hardhat'
import { describe, it } from 'mocha'

import { LatestEMJ, latestEMJFactory } from '../libraries/const'

// Build a bytes32 by concatenating raw UTF-8 byte sequences, left-aligned with NUL padding.
// Used to inject patterns that `encodeBytes32String` won't produce — e.g. mid-NUL sequences.
const bytes32FromRaw = (parts: Uint8Array[]): string => {
    const flattened = parts.reduce<number[]>((acc, p) => acc.concat(Array.from(p)), [])
    if (flattened.length > 32) throw new Error(`raw bytes ${flattened.length} > 32`)
    return zeroPadBytes(hexlify(new Uint8Array(flattened)), 32)
}

// UTF-8 bytes for a JS string.
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

const deployFresh = async (): Promise<LatestEMJ> => {
    const factory = await latestEMJFactory
    return await upgrades.deployProxy(factory) as LatestEMJ
}

// Mint `count` tokens to `to`, after raising the limit. tokenIds start at 1 (per _startTokenId).
const mintTo = async (instance: LatestEMJ, to: string, count: number): Promise<void> => {
    await instance.setMintLimit(count + 100)
    await instance.adminMintTo(to, count)
}

// Test registration helpers. Each helper synchronously calls `it()` once; the awaits
// live inside the mocha callback that runs at test time, not in any loop body.
const registerAccepts = (title: string, text: string): void => {
    it(title, async () => {
        const [, alice] = await ethers.getSigners()
        const instance = await deployFresh()
        await mintTo(instance, alice.address, 1)

        await expect(instance.connect(alice).setStampText(1, encodeBytes32String(text)))
            .to.not.be.reverted
    })
}

const registerReverts = (title: string, text: string): void => {
    it(title, async () => {
        const [, alice] = await ethers.getSigners()
        const instance = await deployFresh()
        await mintTo(instance, alice.address, 1)

        await expect(instance.connect(alice).setStampText(1, encodeBytes32String(text)))
            .to.be.reverted
    })
}

describe("EMJ setStampText validation", () => {
    describe("Access control", () => {
        it("Token owner can set their own stamp text", async () => {
            const [, alice] = await ethers.getSigners()
            const instance = await deployFresh()
            await mintTo(instance, alice.address, 1)

            await expect(instance.connect(alice).setStampText(1, encodeBytes32String("勝利")))
                .to.not.be.reverted
        })

        it("Contract owner can set stamp text on a token they don't own", async () => {
            const [deployer, alice] = await ethers.getSigners()
            const instance = await deployFresh()
            await mintTo(instance, alice.address, 1)
            expect(await instance.owner()).to.equal(deployer.address)
            expect(await instance.ownerOf(1)).to.equal(alice.address)

            await expect(instance.setStampText(1, encodeBytes32String("勝利")))
                .to.not.be.reverted
        })

        it("Third party (neither contract owner nor token owner) is reverted", async () => {
            const [, alice, , , , , mallory] = await ethers.getSigners()
            const instance = await deployFresh()
            await mintTo(instance, alice.address, 1)

            await expect(instance.connect(mallory).setStampText(1, encodeBytes32String("勝利")))
                .to.be.reverted
        })

        it("Non-existent tokenId is reverted", async () => {
            const instance = await deployFresh()
            await instance.setMintLimit(10)
            await instance.adminMint(2)

            await expect(instance.setStampText(99, encodeBytes32String("勝利")))
                .to.be.revertedWith("tokenId not exist")
        })

        it("After token transfer, old owner is reverted and new owner can set", async () => {
            const [, alice, bob] = await ethers.getSigners()
            const instance = await deployFresh()
            await mintTo(instance, alice.address, 1)

            await instance.connect(alice).transferFrom(alice.address, bob.address, 1)

            await expect(instance.connect(alice).setStampText(1, encodeBytes32String("勝利")))
                .to.be.reverted

            await expect(instance.connect(bob).setStampText(1, encodeBytes32String("勝利")))
                .to.not.be.reverted
        })
    })

    describe("Valid text — accepted", () => {
        registerAccepts(`Accepts 漢字 1: "勝"`, "勝")
        registerAccepts(`Accepts 漢字 2: "勝利"`, "勝利")
        registerAccepts(`Accepts ひらがな 1: "あ"`, "あ")
        registerAccepts(`Accepts ひらがな 4: "あいうえ"`, "あいうえ")
        registerAccepts(`Accepts 漢字 1 + ひらがな 1: "勝あ"`, "勝あ")
        registerAccepts(`Accepts 漢字 2 + 改行 + ひらがな 2: "勝利\\nがち"`, "勝利\nがち")
        registerAccepts(`Accepts ひらがな 2 + 改行 + 漢字 2: "いざ\\n勝利"`, "いざ\n勝利")
        registerAccepts(`Accepts 漢字 2 + 改行 + ひらがな 4 (max independent axes): "勝利\\nあいうえ"`, "勝利\nあいうえ")
    })

    describe("Invalid charset — reverts", () => {
        registerReverts(`Reverts on ASCII letters: "abc"`, "abc")
        registerReverts(`Reverts on ASCII digits: "123"`, "123")
        registerReverts(`Reverts on katakana: "カタ"`, "カタ")
        registerReverts(`Reverts on emoji: "🎉"`, "🎉")
        registerReverts(`Reverts on halfwidth symbols: "!?"`, "!?")
        registerReverts(`Reverts on fullwidth symbols: "！？"`, "！？")
    })

    describe("Length over limit — reverts", () => {
        registerReverts(`Reverts on 漢字 3 (>2): "勝利戦"`, "勝利戦")
        registerReverts(`Reverts on ひらがな 5 (>4): "あいうえお"`, "あいうえお")
        registerReverts(`Reverts on 漢字 2 + 改行 + 漢字 1 (漢字 total 3): "勝利\\n戦"`, "勝利\n戦")
        registerReverts(`Reverts on ひらがな 4 + 改行 + ひらがな 1 (ひらがな total 5): "あいうえ\\nお"`, "あいうえ\nお")
    })

    describe("Newline violations — reverts", () => {
        registerReverts(`Reverts on newline count 2: "勝\\n利\\n戦"`, "勝\n利\n戦")
        registerReverts(`Reverts on leading newline: "\\n勝利"`, "\n勝利")
        registerReverts(`Reverts on trailing newline: "勝利\\n"`, "勝利\n")
        registerReverts(`Reverts on newline only: "\\n"`, "\n")
    })

    describe("Empty input — reverts", () => {
        it("Reverts on all-NUL bytes32", async () => {
            const [, alice] = await ethers.getSigners()
            const instance = await deployFresh()
            await mintTo(instance, alice.address, 1)

            const allNul = `0x${"00".repeat(32)}`
            await expect(instance.connect(alice).setStampText(1, allNul))
                .to.be.reverted
        })
    })

    describe("Mid-NUL — reverts", () => {
        it("Reverts when a NUL byte appears between non-NUL bytes (not strict left-aligned)", async () => {
            const [, alice] = await ethers.getSigners()
            const instance = await deployFresh()
            await mintTo(instance, alice.address, 1)

            // 「勝」(0xE5 0x8B 0x9D) + 0x00 + 「利」(0xE5 0x88 0xA9), rest NUL-padded
            const midNul = bytes32FromRaw([
                utf8("勝"),
                new Uint8Array([0x00]),
                utf8("利"),
            ])
            // Sanity check the constructed bytes32 actually has the mid-NUL pattern.
            const raw = getBytes(midNul)
            expect(raw[3]).to.equal(0x00)
            expect(raw[4]).to.not.equal(0x00)

            await expect(instance.connect(alice).setStampText(1, midNul))
                .to.be.reverted
        })
    })

    describe("Overwrite — last write wins", () => {
        it("Different text on second call replaces the stored value (tokenURI reflects latest)", async () => {
            const [, alice] = await ethers.getSigners()
            const instance = await deployFresh()
            await mintTo(instance, alice.address, 1)

            await instance.connect(alice).setStampText(1, encodeBytes32String("勝利"))
            await instance.connect(alice).setStampText(1, encodeBytes32String("敗北"))

            expect(await instance.tokenURI(1))
                .to.equal(`https://mojiemoji.jozo.beer/?text=${encodeURIComponent("敗北")}`)
        })

        it("Same text twice is idempotent (no revert, tokenURI unchanged)", async () => {
            const [, alice] = await ethers.getSigners()
            const instance = await deployFresh()
            await mintTo(instance, alice.address, 1)

            await instance.connect(alice).setStampText(1, encodeBytes32String("勝利"))
            await expect(instance.connect(alice).setStampText(1, encodeBytes32String("勝利")))
                .to.not.be.reverted

            expect(await instance.tokenURI(1))
                .to.equal(`https://mojiemoji.jozo.beer/?text=${encodeURIComponent("勝利")}`)
        })
    })
})
