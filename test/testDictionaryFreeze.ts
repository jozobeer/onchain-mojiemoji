import { expect } from "chai"
import { Contract, toUtf8Bytes } from "ethers"
import { ethers, upgrades } from "hardhat"
import { describe, it } from "mocha"

// ADR-0003: Dictionary に one-way kill switch `freeze()` を追加し、freeze 後は
// `_authorizeUpgrade` が常に revert することで append-only invariant を契約レベルに
// 固定する。本 spec はその不変条件を pin する。

const word = (s: string): Uint8Array => toUtf8Bytes(s)

const deployDictionary = async (initialWords: Uint8Array[]): Promise<Contract> => {
    const factory = await ethers.getContractFactory("Dictionary")
    const proxy = await upgrades.deployProxy(factory, [initialWords], { kind: "uups" })
    return proxy as unknown as Contract
}

describe("Dictionary freeze (ADR-0003)", () => {
    describe("Initial State", () => {
        it("Reports frozen=false right after deployment", async () => {
            const dict = await deployDictionary([word("焼く")])
            expect(await dict.frozen()).to.equal(false)
        })

        it("Exposes freeze in the ABI", async () => {
            const dict = await deployDictionary([])
            expect(dict.interface.hasFunction("freeze")).to.equal(true)
        })
    })

    describe("freeze() access control", () => {
        it("Allows the owner to freeze", async () => {
            const dict = await deployDictionary([word("焼く")])
            await dict.freeze()
            expect(await dict.frozen()).to.equal(true)
        })

        it("Reverts when a non-owner calls freeze", async () => {
            const [, alice] = await ethers.getSigners()
            const dict = await deployDictionary([word("焼く")])
            await expect(dict.connect(alice).freeze()).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("Reverts on a second freeze with `already frozen`", async () => {
            const dict = await deployDictionary([word("焼く")])
            await dict.freeze()
            await expect(dict.freeze()).to.be.revertedWith("already frozen")
        })
    })

    describe("freeze() events", () => {
        it("Emits UpgradesFrozen on freeze", async () => {
            const dict = await deployDictionary([word("焼く")])
            await expect(dict.freeze()).to.emit(dict, "UpgradesFrozen")
        })

        it("Does not emit UpgradesFrozen on a second (reverting) freeze", async () => {
            const dict = await deployDictionary([word("焼く")])
            await dict.freeze()
            await expect(dict.freeze()).to.be.reverted
        })
    })

    describe("Upgrade authorization after freeze", () => {
        it("Reverts upgradeTo with `upgrades frozen` after freeze", async () => {
            const dict = await deployDictionary([word("焼く")])
            await dict.freeze()
            const factory = await ethers.getContractFactory("Dictionary")
            await expect(upgrades.upgradeProxy(await dict.getAddress(), factory)).to.be.revertedWith("upgrades frozen")
        })

        it("Allows upgradeTo before freeze", async () => {
            const dict = await deployDictionary([word("焼く")])
            const factory = await ethers.getContractFactory("Dictionary")
            // Reusing the same factory exercises the upgrade path itself, not a behavioral change.
            await expect(upgrades.upgradeProxy(await dict.getAddress(), factory)).to.not.be.reverted
        })
    })

    describe("Other surface preserved after freeze (append-only stays open)", () => {
        it("Still appends words via addWords after freeze", async () => {
            const dict = await deployDictionary([word("焼く")])
            await dict.freeze()
            await dict.addWords([word("勝った")])
            expect(await dict.wordCount()).to.equal(2)
        })

        it("Still returns words via wordAt after freeze", async () => {
            const dict = await deployDictionary([word("焼く")])
            await dict.freeze()
            const w = word("勝った")
            await dict.addWords([w])
            expect(await dict.wordAt(1)).to.equal(ethers.hexlify(w))
        })

        it("Still allows ownership transfer (Ownable2Step) after freeze", async () => {
            const [, alice] = await ethers.getSigners()
            const dict = await deployDictionary([word("焼く")])
            await dict.freeze()
            await dict.transferOwnership(alice.address)
            await dict.connect(alice).acceptOwnership()
            expect(await dict.owner()).to.equal(alice.address)
        })

        it("Allows the new owner to addWords after freeze + ownership handover", async () => {
            const [, alice] = await ethers.getSigners()
            const dict = await deployDictionary([word("焼く")])
            await dict.freeze()
            await dict.transferOwnership(alice.address)
            await dict.connect(alice).acceptOwnership()
            await dict.connect(alice).addWords([word("勝った")])
            expect(await dict.wordCount()).to.equal(2)
        })

        it("Still blocks the new owner from upgrading after freeze + ownership handover", async () => {
            const [, alice] = await ethers.getSigners()
            const dict = await deployDictionary([word("焼く")])
            await dict.freeze()
            await dict.transferOwnership(alice.address)
            await dict.connect(alice).acceptOwnership()
            const factory = await ethers.getContractFactory("Dictionary", alice)
            await expect(upgrades.upgradeProxy(await dict.getAddress(), factory)).to.be.revertedWith("upgrades frozen")
        })
    })
})
