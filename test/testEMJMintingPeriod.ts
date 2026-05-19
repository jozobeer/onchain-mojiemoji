import { expect } from 'chai'
import { keccak256, parseEther } from 'ethers'
import { ethers, upgrades } from 'hardhat'
import { describe, it } from 'mocha'

import { LatestEMJ, latestEMJFactory } from '../libraries/const'
import createMerkleTree from '../libraries/createMerkleTree'

describe("EMJ Minting Period", () => {
    it("Can public mint if minting period is not set", async () => {
        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ
        const [, alice] = await ethers.getSigners()

        await instance.setMintLimit(10)
        await instance.setPublicMintPrice(parseEther("1"))

        await instance.connect(alice).publicMint(1, { value: parseEther("1") })
    })

    it("Can't set public minting period if start date is later than end date", async () => {
        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ

        const now = (await ethers.provider.getBlock("latest"))?.timestamp || 0
        const yesterday = now - 86400
        const dayBeforeYesterday = yesterday - 86400

        await expect(instance.setPublicMintAvailablePeriod(yesterday, dayBeforeYesterday))
            .to.be.revertedWith("invalid period")
    })

    it("Can't public mint if minting period is not started", async () => {
        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ
        const [, alice] = await ethers.getSigners()

        await instance.setMintLimit(10)
        await instance.setPublicMintPrice(parseEther("1"))

        const now = (await ethers.provider.getBlock("latest"))?.timestamp || 0
        const tommorow = now + 86400
        const dayAfterTommorow = tommorow + 86400
        await instance.setPublicMintAvailablePeriod(tommorow, dayAfterTommorow)

        await expect(instance.connect(alice).publicMint(1, { value: parseEther("1") }))
            .to.be.revertedWith("public minting: not started or ended")
    })

    it("Can't public mint if minting period is ended", async () => {
        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ
        const [, alice] = await ethers.getSigners()

        await instance.setMintLimit(10)
        await instance.setPublicMintPrice(parseEther("1"))

        const now = (await ethers.provider.getBlock("latest"))?.timestamp || 0
        const yesterday = now - 86400
        const dayBeforeYesterday = yesterday - 86400
        await instance.setPublicMintAvailablePeriod(dayBeforeYesterday, yesterday)

        await expect(instance.connect(alice).publicMint(1, { value: parseEther("1") }))
            .to.be.revertedWith("public minting: not started or ended")
    })

    it("Can public mint if it's in minting period", async () => {
        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ
        const [, alice] = await ethers.getSigners()

        await instance.setMintLimit(10)
        await instance.setPublicMintPrice(parseEther("1"))

        const now = (await ethers.provider.getBlock("latest"))?.timestamp || 0
        const yesterday = now - 86400
        const tommorow = now + 86400
        await instance.setPublicMintAvailablePeriod(yesterday, tommorow)

        await instance.connect(alice).publicMint(1, { value: parseEther("1") })
    })

    it("Can allowlist mint if minting period is not set", async () => {
        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ
        const [, alice, bob] = await ethers.getSigners()

        await instance.setMintLimit(10)
        await instance.setAllowlistMintPrice(parseEther("1"))

        // register allowlist
        const allowlisted = [alice, bob].map(account => account.address)
        const tree = createMerkleTree(allowlisted)
        const root = tree.getHexRoot()
        await instance.setAllowlist(root)

        const proof = tree.getHexProof(keccak256(alice.address))
        await instance.connect(alice).allowlistMint(1, proof, { value: parseEther("1") })
    })

    it("Can't set allowlist minting period if start date is later than end date", async () => {
        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ

        const now = (await ethers.provider.getBlock("latest"))?.timestamp || 0
        const yesterday = now - 86400
        const dayBeforeYesterday = yesterday - 86400

        await expect(instance.setAllowlistMintAvailablePeriod(yesterday, dayBeforeYesterday))
            .to.be.revertedWith("invalid period")
    })

    it("Can't allowlist mint if minting period is not started", async () => {
        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ
        const [, alice, bob] = await ethers.getSigners()

        await instance.setMintLimit(10)
        await instance.setAllowlistMintPrice(parseEther("1"))

        // register allowlist
        const allowlisted = [alice, bob].map(account => account.address)
        const tree = createMerkleTree(allowlisted)
        const root = tree.getHexRoot()
        await instance.setAllowlist(root)

        const now = (await ethers.provider.getBlock("latest"))?.timestamp || 0
        const tommorow = now + 86400
        const dayAfterTommorow = tommorow + 86400
        await instance.setAllowlistMintAvailablePeriod(tommorow, dayAfterTommorow)

        const proof = tree.getHexProof(keccak256(alice.address))
        await expect(instance.connect(alice).allowlistMint(1, proof, { value: parseEther("1") }))
            .to.be.revertedWith("allowlist minting: not started or ended")
    })

    it("Can't allowlist mint if minting period is ended", async () => {
        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ
        const [, alice, bob] = await ethers.getSigners()

        await instance.setMintLimit(10)
        await instance.setAllowlistMintPrice(parseEther("1"))

        // register allowlist
        const allowlisted = [alice, bob].map(account => account.address)
        const tree = createMerkleTree(allowlisted)
        const root = tree.getHexRoot()
        await instance.setAllowlist(root)

        const now = (await ethers.provider.getBlock("latest"))?.timestamp || 0
        const yesterday = now - 86400
        const dayBeforeYesterday = yesterday - 86400
        await instance.setAllowlistMintAvailablePeriod(dayBeforeYesterday, yesterday)

        const proof = tree.getHexProof(keccak256(alice.address))
        await expect(instance.connect(alice).allowlistMint(1, proof, { value: parseEther("1") }))
            .to.be.revertedWith("allowlist minting: not started or ended")
    })

    it("Can allowlist mint if it's in minting period", async () => {
        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ
        const [, alice, bob] = await ethers.getSigners()

        await instance.setMintLimit(10)
        await instance.setAllowlistMintPrice(parseEther("1"))

        // register allowlist
        const allowlisted = [alice, bob].map(account => account.address)
        const tree = createMerkleTree(allowlisted)
        const root = tree.getHexRoot()
        await instance.setAllowlist(root)

        const now = (await ethers.provider.getBlock("latest"))?.timestamp || 0
        const yesterday = now - 86400
        const tommorow = now + 86400
        await instance.setAllowlistMintAvailablePeriod(yesterday, tommorow)

        const proof = tree.getHexProof(keccak256(alice.address))
        await instance.connect(alice).allowlistMint(1, proof, { value: parseEther("1") })
    })
})