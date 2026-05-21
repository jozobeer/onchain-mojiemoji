import { expect } from "chai"
import { keccak256, parseEther, ZeroAddress } from "ethers"
import { ethers } from "hardhat"
import { describe } from "mocha"

import { deployFreshEMJ } from "../libraries/const"
import createMerkleTree from "../libraries/createMerkleTree"

describe("Mint ALC as allowlisted member", () => {
    it("Allowlisted member can mint", async () => {
        const instance = await deployFreshEMJ()

        const [, john, jonny, jonathan] = await ethers.getSigners()

        await instance.setMintLimit(100)
        await instance.setAllowlistedMemberMintLimit(5)

        // register allowlist
        const allowlisted = [john, jonny, jonathan].map((account) => account.address)
        const tree = createMerkleTree(allowlisted)
        const root = tree.getHexRoot()
        await instance.setAllowlist(root)

        // check balance to mint
        const price = await instance.allowlistMintPrice()
        const quantity = await instance.allowlistedMemberMintLimit()
        const totalPrice = price * quantity
        const balance = await ethers.provider.getBalance(john)
        expect(balance).is.greaterThanOrEqual(totalPrice)

        // mint
        const proof = tree.getHexProof(keccak256(john.address))
        await expect(
            await instance.connect(john).allowlistMint(quantity, proof, { value: totalPrice }),
        ).to.changeEtherBalances([instance, john], [totalPrice, -totalPrice])

        expect(await instance.allowlistMemberMintCount(john.address)).to.equal(quantity)
    })

    it("Not allowlisted member's minting is not allowed", async () => {
        const instance = await deployFreshEMJ()

        const [, john, jonny, jonathan, mike] = await ethers.getSigners()

        await instance.setMintLimit(100)
        await instance.setAllowlistedMemberMintLimit(5)

        // register allowlist
        const allowlisted = [john, jonny, jonathan].map((account) => account.address)
        const tree = createMerkleTree(allowlisted)
        const root = tree.getHexRoot()
        await instance.setAllowlist(root)

        // try to mint
        const proof = tree.getHexProof(keccak256(mike.address))
        const enoughBadget = parseEther("1000")
        await expect(instance.connect(mike).allowlistMint(5, proof, { value: enoughBadget })).to.revertedWith(
            "invalid merkle proof",
        )
    })

    it("Allowlisted member can mint but not over the limit", async () => {
        const instance = await deployFreshEMJ()

        const [, john, jonny, jonathan] = await ethers.getSigners()

        await instance.setMintLimit(100)
        await instance.setAllowlistedMemberMintLimit(5)

        // register allowlist
        const allowlisted = [john, jonny, jonathan].map((account) => account.address)
        const tree = createMerkleTree(allowlisted)
        const root = tree.getHexRoot()
        await instance.setAllowlist(root)

        // check balance to mint
        const price = await instance.allowlistMintPrice()
        const quantity = await instance.allowlistedMemberMintLimit()
        const totalPrice = price * quantity
        const balance = await ethers.provider.getBalance(jonathan)
        expect(balance).is.greaterThanOrEqual(totalPrice)

        const proofOfJonathan = tree.getHexProof(keccak256(jonathan.address))
        await expect(
            await instance.connect(jonathan).allowlistMint(quantity, proofOfJonathan, { value: totalPrice }),
        ).to.changeEtherBalances([instance, jonathan], [totalPrice, -totalPrice])

        expect(await instance.allowlistMemberMintCount(jonathan.address)).to.equal(quantity)

        // try to mint more and fail
        await expect(
            instance.connect(jonathan).allowlistMint(quantity, proofOfJonathan, { value: totalPrice }),
        ).to.revertedWith("allowlist minting exceeds the limit")

        // but other guy is still ok
        const proofOfJonny = tree.getHexProof(keccak256(jonny.address))
        await instance.connect(jonny).allowlistMint(quantity, proofOfJonny, { value: totalPrice })

        expect(await instance.allowlistMemberMintCount(jonny.address)).to.equal(quantity)
    })

    it("Allowlisted member exceeding the limit of allowlist mint can mint after the sale id is changed", async () => {
        const instance = await deployFreshEMJ()

        const [, john, jonny, jonathan] = await ethers.getSigners()

        await instance.setMintLimit(100)
        await instance.setAllowlistedMemberMintLimit(5)

        // register allowlist
        const allowlisted = [john, jonny, jonathan].map((account) => account.address)
        const tree = createMerkleTree(allowlisted)
        const root = tree.getHexRoot()
        await instance.setAllowlist(root)

        // check balance to mint
        const price = await instance.allowlistMintPrice()
        const quantity = await instance.allowlistedMemberMintLimit()
        const totalPrice = price * quantity
        const balance = await ethers.provider.getBalance(jonathan)
        expect(balance).is.greaterThanOrEqual(totalPrice)

        const proofOfJonathan = tree.getHexProof(keccak256(jonathan.address))
        await expect(
            await instance.connect(jonathan).allowlistMint(quantity, proofOfJonathan, { value: totalPrice }),
        ).to.changeEtherBalances([instance, jonathan], [totalPrice, -totalPrice])

        expect(await instance.allowlistMemberMintCount(jonathan.address)).to.equal(quantity)

        // try to mint more and fail
        await expect(
            instance.connect(jonathan).allowlistMint(quantity, proofOfJonathan, { value: totalPrice }),
        ).to.be.revertedWith("allowlist minting exceeds the limit")

        await instance.incrementAllowlistSaleId()

        // now jonathan can mint again
        await instance.connect(jonathan).allowlistMint(quantity, proofOfJonathan, { value: totalPrice })

        expect(await instance.allowlistMemberMintCount(jonathan.address)).to.equal(quantity)
    })

    it("Allowlisted member can mint in allowlist mint limit but not over the limit of entire contract", async () => {
        const instance = await deployFreshEMJ()

        const [, john, jonny, jonathan] = await ethers.getSigners()

        await instance.setMintLimit(15)
        await instance.setAllowlistedMemberMintLimit(20)

        // register allowlist
        const allowlisted = [john, jonny, jonathan].map((account) => account.address)
        const tree = createMerkleTree(allowlisted)
        const root = tree.getHexRoot()
        await instance.setAllowlist(root)

        // check balance to mint
        const price = await instance.allowlistMintPrice()
        const quantity = await instance.allowlistedMemberMintLimit()
        const totalPrice = price * quantity
        const balance = await ethers.provider.getBalance(jonathan)
        expect(balance).is.greaterThanOrEqual(totalPrice)

        const proofOfJonathan = tree.getHexProof(keccak256(jonathan.address))
        await expect(
            instance.connect(jonathan).allowlistMint(quantity, proofOfJonathan, { value: totalPrice }),
        ).to.revertedWith("minting exceeds the limit")
    })

    it("Cannot mint if sent ETH is not enough", async () => {
        const instance = await deployFreshEMJ()

        const [, john, jonny, jonathan] = await ethers.getSigners()

        await instance.setMintLimit(100)
        await instance.setAllowlistedMemberMintLimit(5)

        // register allowlist
        const allowlisted = [john, jonny, jonathan].map((account) => account.address)
        const tree = createMerkleTree(allowlisted)
        const root = tree.getHexRoot()
        await instance.setAllowlist(root)

        // check balance to mint
        const price = await instance.allowlistMintPrice()
        const quantity = await instance.allowlistedMemberMintLimit()
        const totalPrice = price * quantity
        const balance = await ethers.provider.getBalance(john)
        expect(balance).is.greaterThanOrEqual(totalPrice)

        // try to mint without enough ETH
        const proof = tree.getHexProof(keccak256(john.address))
        const paid = (totalPrice * 99n) / 100n // 99% of total price
        await expect(instance.connect(john).allowlistMint(quantity, proof, { value: paid })).to.revertedWith(
            "invalid amount of eth sent",
        )
    })

    it("Cannot mint if too much ETH is sent", async () => {
        const instance = await deployFreshEMJ()

        const [, john, jonny, jonathan] = await ethers.getSigners()

        await instance.setMintLimit(100)
        await instance.setAllowlistedMemberMintLimit(5)

        // register allowlist
        const allowlisted = [john, jonny, jonathan].map((account) => account.address)
        const tree = createMerkleTree(allowlisted)
        const root = tree.getHexRoot()
        await instance.setAllowlist(root)

        // check balance to mint
        const price = await instance.allowlistMintPrice()
        const quantity = await instance.allowlistedMemberMintLimit()
        const totalPrice = price * quantity
        const balance = await ethers.provider.getBalance(john)
        expect(balance).is.greaterThanOrEqual(totalPrice)

        // try to mint without enough ETH
        const proof = tree.getHexProof(keccak256(john.address))
        const paid = (totalPrice * 101n) / 100n // 101% of total price
        await expect(instance.connect(john).allowlistMint(quantity, proof, { value: paid })).to.revertedWith(
            "invalid amount of eth sent",
        )
    })

    it("Only contract owner can increment allowlist sale id", async () => {
        const instance = await deployFreshEMJ()

        const [, john] = await ethers.getSigners()

        await expect(instance.connect(john).incrementAllowlistSaleId()).to.be.revertedWith(
            "Ownable: caller is not the owner",
        )
    })

    it("Allowlist minting emits events", async () => {
        const instance = await deployFreshEMJ()

        const [, john, jonny, jonathan] = await ethers.getSigners()

        await instance.setMintLimit(100)
        await instance.setAllowlistedMemberMintLimit(5)

        // register allowlist
        const allowlisted = [john, jonny, jonathan].map((account) => account.address)
        const tree = createMerkleTree(allowlisted)
        const root = tree.getHexRoot()
        await instance.setAllowlist(root)

        // check balance to mint
        const price = await instance.allowlistMintPrice()
        const quantity = await instance.allowlistedMemberMintLimit()
        const totalPrice = price * quantity
        const balance = await ethers.provider.getBalance(john)
        expect(balance).is.greaterThanOrEqual(totalPrice)

        const proof = tree.getHexProof(keccak256(john.address))
        await expect(instance.connect(john).allowlistMint(quantity, proof, { value: totalPrice }))
            .to.emit(instance, "Transfer")
            .withArgs(ZeroAddress, john.address, quantity)
            .to.emit(instance, "AllowlistMinted")
            .withArgs(john.address, 1n, quantity)
    })
})
