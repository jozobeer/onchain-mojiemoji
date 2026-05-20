import { expect } from "chai"
import { ZeroAddress } from "ethers"
import { ethers, upgrades } from "hardhat"
import { describe, it } from "mocha"

import { LatestEMJ, latestEMJFactory } from "../libraries/const"

describe("Burn EMJ", () => {
    it("Owner can burn then totalSupply decreased", async () => {
        const [deployer] = await ethers.getSigners()

        const factory = await latestEMJFactory
        const instance = (await upgrades.deployProxy(factory)) as LatestEMJ

        await instance.setMintLimit(10)
        await expect(instance.adminMint(5)).to.emit(instance, "Transfer").withArgs(ZeroAddress, deployer.address, 4)

        expect(await instance.totalSupply()).to.equal(5)
        expect(await instance.ownerOf(3)).to.equal(deployer.address)

        await expect(await instance.burn(1))
            .to.emit(instance, "Transfer")
            .withArgs(deployer.address, ZeroAddress, 1)

        await expect(instance.burn(2)).to.emit(instance, "Transfer").withArgs(deployer.address, ZeroAddress, 2)

        await expect(instance.burn(3)).to.emit(instance, "Transfer").withArgs(deployer.address, ZeroAddress, 3)

        expect(await instance.totalSupply()).to.equal(2)
        await expect(instance.ownerOf(3)).to.be.reverted
    })

    it("Cannot burn same token twice", async () => {
        const factory = await latestEMJFactory
        const instance = (await upgrades.deployProxy(factory)) as LatestEMJ

        await instance.setMintLimit(10)
        await instance.adminMint(5)

        await instance.burn(2)
        await expect(instance.burn(2)).to.reverted
    })

    it("Burning doesn't release the minting spaces", async () => {
        const [deployer] = await ethers.getSigners()

        const factory = await latestEMJFactory
        const instance = (await upgrades.deployProxy(factory)) as LatestEMJ

        await instance.setMintLimit(5)

        await expect(instance.adminMint(5)).to.emit(instance, "Transfer").withArgs(ZeroAddress, deployer.address, 5)

        expect(await instance.totalSupply()).to.equal(5)

        await expect(await instance.burn(1))
            .to.emit(instance, "Transfer")
            .withArgs(deployer.address, ZeroAddress, 1)

        await expect(instance.burn(2)).to.emit(instance, "Transfer").withArgs(deployer.address, ZeroAddress, 2)

        await expect(instance.burn(3)).to.emit(instance, "Transfer").withArgs(deployer.address, ZeroAddress, 3)

        expect(await instance.totalSupply()).to.equal(2)
        // burn reduces totalSupply but does't release space for future mint
        await expect(instance.adminMint(5)).to.be.reverted
    })

    it("Reading tokenURI should be reverted for tokenId which is already burned", async () => {
        const factory = await latestEMJFactory
        const instance = (await upgrades.deployProxy(factory)) as LatestEMJ

        await instance.setMintLimit(10)
        await instance.adminMint(10)
        await instance.burn(6)

        await expect(instance.tokenURI(6)).to.reverted
    })

    it("Only owner and token owner can burn the token", async () => {
        const [, alice, , , , , mallory] = await ethers.getSigners()

        const factory = await latestEMJFactory
        const instance = (await upgrades.deployProxy(factory)) as LatestEMJ

        await instance.setMintLimit(3)
        await expect(instance.adminMintTo(alice.address, 3))
            .to.emit(instance, "Transfer")
            .withArgs(ZeroAddress, alice.address, 3)

        await expect(instance.burn(1)).to.emit(instance, "Transfer").withArgs(alice.address, ZeroAddress, 1)

        await expect(instance.connect(alice).burn(2))
            .to.emit(instance, "Transfer")
            .withArgs(alice.address, ZeroAddress, 2)

        await expect(instance.connect(mallory).burn(3)).to.be.reverted
    })
})
