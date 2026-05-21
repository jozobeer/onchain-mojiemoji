import { expect } from "chai"
import { BytesLike, Contract, hexlify, toUtf8Bytes } from "ethers"
import { ethers, upgrades } from "hardhat"
import { describe, it } from "mocha"

// ADR-0002: Upgradeable Dictionary contract のテスト spec。
// 単語完成形を 1 配列で保持。validation / 重複検出 / 長さチェックは
// すべて TypeScript の責務（scripts/dictionary/sanitize.ts、別 PR）。
// contract は dumb data store。

const word = (s: string): Uint8Array => toUtf8Bytes(s)

const asHex = (bytes: BytesLike): string => hexlify(bytes)

async function deployDictionary(initialWords: Uint8Array[]): Promise<Contract> {
    const factory = await ethers.getContractFactory("Dictionary")
    const proxy = await upgrades.deployProxy(factory, [initialWords], { kind: "uups" })
    return proxy as unknown as Contract
}

describe("Dictionary", () => {
    describe("Initial State", () => {
        it("Reports wordCount equal to the number of initial words", async () => {
            const dict = await deployDictionary([word("焼く"), word("勝った"), word("光る")])
            expect(await dict.wordCount()).to.equal(3)
        })

        it("Accepts an empty initial words array and reports wordCount as 0", async () => {
            const dict = await deployDictionary([])
            expect(await dict.wordCount()).to.equal(0)
        })

        it("Returns each initial word verbatim via wordAt", async () => {
            const initial = [word("焼く"), word("勝った"), word("光る")]
            const dict = await deployDictionary(initial)
            expect(await dict.wordAt(0)).to.equal(asHex(initial[0]))
            expect(await dict.wordAt(1)).to.equal(asHex(initial[1]))
            expect(await dict.wordAt(2)).to.equal(asHex(initial[2]))
        })

        it("Sets the deployer as the initial owner", async () => {
            const [deployer] = await ethers.getSigners()
            const dict = await deployDictionary([])
            expect(await dict.owner()).to.equal(deployer.address)
        })
    })

    describe("Add and Read", () => {
        it("Appends words to the existing list and increases wordCount", async () => {
            const dict = await deployDictionary([word("焼く")])
            await dict.addWords([word("勝った"), word("夢を見る")])
            expect(await dict.wordCount()).to.equal(3)
        })

        it("Returns the appended word at the new index", async () => {
            const dict = await deployDictionary([word("焼く")])
            const added = word("勝った")
            await dict.addWords([added])
            expect(await dict.wordAt(1)).to.equal(asHex(added))
        })

        it("Allows multiple addWords calls and appends in call order", async () => {
            const dict = await deployDictionary([])
            await dict.addWords([word("焼く")])
            await dict.addWords([word("勝った"), word("光る")])
            expect(await dict.wordCount()).to.equal(3)
            expect(await dict.wordAt(0)).to.equal(asHex(word("焼く")))
            expect(await dict.wordAt(2)).to.equal(asHex(word("光る")))
        })

        it("Emits WordsAdded with the start index and count", async () => {
            const dict = await deployDictionary([word("焼く")])
            await expect(dict.addWords([word("勝った"), word("夢を見る")]))
                .to.emit(dict, "WordsAdded")
                .withArgs(1, 2)
        })

        it("Emits WordsAdded even for an empty array call (count = 0)", async () => {
            const dict = await deployDictionary([word("焼く")])
            await expect(dict.addWords([])).to.emit(dict, "WordsAdded").withArgs(1, 0)
        })

        it("Treats empty array addWords as a no-op (wordCount unchanged)", async () => {
            const dict = await deployDictionary([word("焼く")])
            await dict.addWords([])
            expect(await dict.wordCount()).to.equal(1)
        })
    })

    describe("Append-only Invariance", () => {
        it("Preserves existing index value after addWords", async () => {
            const first = word("焼く")
            const dict = await deployDictionary([first])
            await dict.addWords([word("勝った"), word("夢を見る")])
            expect(await dict.wordAt(0)).to.equal(asHex(first))
        })

        it("Does not expose setWord in the ABI", async () => {
            const dict = await deployDictionary([word("焼く")])
            expect(dict.interface.hasFunction("setWord")).to.equal(false)
        })

        it("Does not expose removeWord in the ABI", async () => {
            const dict = await deployDictionary([word("焼く")])
            expect(dict.interface.hasFunction("removeWord")).to.equal(false)
        })
    })

    describe("Dumb Data Store (no validation)", () => {
        // contract は validation しない (TypeScript 責務)。
        // contract が空 bytes / 重複 / 長さ過大を受け入れることを明示的に検証。
        // この設計選択は ADR-0002 §6 に確定。

        it("Accepts an empty bytes element (no validation in contract)", async () => {
            const dict = await deployDictionary([])
            const emptyBytes = new Uint8Array(0)
            await expect(dict.addWords([emptyBytes])).to.not.be.reverted
            expect(await dict.wordCount()).to.equal(1)
            expect(await dict.wordAt(0)).to.equal(asHex(emptyBytes))
        })

        it("Accepts duplicate words (no validation in contract)", async () => {
            const dict = await deployDictionary([])
            await dict.addWords([word("焼く"), word("焼く")])
            expect(await dict.wordCount()).to.equal(2)
            expect(await dict.wordAt(0)).to.equal(await dict.wordAt(1))
        })

        it("Accepts very long bytes (no length cap in contract)", async () => {
            const dict = await deployDictionary([])
            // 100 bytes — URL guideline では長すぎるが contract は受け取る
            const long = new Uint8Array(100).fill(0x61)
            await expect(dict.addWords([long])).to.not.be.reverted
            expect(await dict.wordAt(0)).to.equal(asHex(long))
        })
    })

    describe("Access Control", () => {
        it("Reverts when a non-owner calls addWords", async () => {
            const [, alice] = await ethers.getSigners()
            const dict = await deployDictionary([word("焼く")])
            await expect(dict.connect(alice).addWords([word("勝った")])).to.be.revertedWith(
                "Ownable: caller is not the owner",
            )
        })

        it("Allows the new owner to addWords after ownership transfer", async () => {
            const [, alice] = await ethers.getSigners()
            const dict = await deployDictionary([word("焼く")])
            await dict.transferOwnership(alice.address)
            await dict.connect(alice).acceptOwnership()
            await expect(dict.connect(alice).addWords([word("勝った")])).to.not.be.reverted
        })

        it("Rejects the previous owner after ownership transfer", async () => {
            const [deployer, alice] = await ethers.getSigners()
            const dict = await deployDictionary([word("焼く")])
            await dict.transferOwnership(alice.address)
            await dict.connect(alice).acceptOwnership()
            await expect(dict.connect(deployer).addWords([word("勝った")])).to.be.revertedWith(
                "Ownable: caller is not the owner",
            )
        })
    })

    describe("Boundary", () => {
        it("Reverts wordAt(wordCount()) (off-by-one)", async () => {
            const dict = await deployDictionary([word("焼く"), word("勝った")])
            await expect(dict.wordAt(2)).to.be.reverted
        })

        it("Reverts wordAt on an empty dictionary", async () => {
            const dict = await deployDictionary([])
            await expect(dict.wordAt(0)).to.be.reverted
        })
    })

    describe("UUPS Upgrade", () => {
        it("Deploys successfully via UUPS proxy", async () => {
            const dict = await deployDictionary([word("焼く")])
            expect(await dict.getAddress()).to.properAddress
        })

        it("Preserves word storage across upgrade", async () => {
            const initial = word("焼く")
            const dict = await deployDictionary([initial])
            const factory = await ethers.getContractFactory("Dictionary")
            const upgraded = await upgrades.upgradeProxy(await dict.getAddress(), factory)
            expect(await upgraded.wordAt(0)).to.equal(asHex(initial))
        })

        it("Reverts upgrade when caller is not the owner", async () => {
            const [, alice] = await ethers.getSigners()
            const dict = await deployDictionary([word("焼く")])
            const factoryAsAlice = await ethers.getContractFactory("Dictionary", alice)
            await expect(
                upgrades.upgradeProxy(await dict.getAddress(), factoryAsAlice),
            ).to.be.revertedWith("Ownable: caller is not the owner")
        })
    })
})
