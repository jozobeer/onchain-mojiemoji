import { expect } from 'chai'
import { keccak256, toUtf8Bytes } from 'ethers'
import { upgrades } from 'hardhat'
import { describe, it } from 'mocha'

import { LatestEMJ, latestEMJFactory } from '../libraries/const'

describe("EMJ TokenURI", () => {
    it("Check if TokenURI doesn't end with slash, the value will be reverted", async () => {
        const instance = await upgrades.deployProxy(await latestEMJFactory) as LatestEMJ
        // URI ends with slash is ok
        await expect(instance.setBaseURI("https://sample.com/")).to.not.be.reverted
        // but URI without slash is not ok
        await expect(instance.setBaseURI("https://sample.com")).to.be.revertedWith("invalid suffix")
    })

    it("Check if revealTimestamp is not set, always returns individual URI", async () => {
        const instance = await upgrades.deployProxy(await latestEMJFactory) as LatestEMJ
        await instance.setMintLimit(10)
        await instance.setBaseURI("https://sample.com/")
        await instance.setKeccakPrefix("Ex_")

        await instance.adminMint(5)

        const hash = keccak256(toUtf8Bytes("Ex_3"))
        expect(hash.startsWith("0x")).to.be.true
        const name = hash.substring(2)

        expect(await instance.tokenURI(3))
            .to.equal(`https://sample.com/${name}.json`)
    })

    it("Check if revealTimestamp is set, returns seed URI before revealTimestamp", async () => {
        const instance = await upgrades.deployProxy(await latestEMJFactory) as LatestEMJ
        await instance.setMintLimit(10)
        await instance.setBaseURI("https://sample.com/")
        await instance.setKeccakPrefix("Ex_")

        const tommorow = Math.floor(Date.now() / 1000) + 86400
        await instance.setRevealTimestamp(tommorow)

        await instance.adminMint(5)

        expect(await instance.tokenURI(3))
            .to.equal(`https://sample.com/seed.json`)
    })

    it("Check if revealTimestamp is set, returns individual URI after revealTimestamp", async () => {
        const instance = await upgrades.deployProxy(await latestEMJFactory) as LatestEMJ
        await instance.setMintLimit(10)
        await instance.setBaseURI("https://sample.com/")
        await instance.setKeccakPrefix("Ex_")

        const yesterday = Math.floor(Date.now() / 1000) - 86400
        await instance.setRevealTimestamp(yesterday)

        await instance.adminMint(5)

        const hash = keccak256(toUtf8Bytes("Ex_3"))
        expect(hash.startsWith("0x")).to.be.true
        const name = hash.substring(2)

        expect(await instance.tokenURI(3))
            .to.equal(`https://sample.com/${name}.json`)
    })

    it("Check if revealTimestamp means just now, returns individual URI after revealTimestamp", async () => {
        const instance = await upgrades.deployProxy(await latestEMJFactory) as LatestEMJ
        await instance.setMintLimit(10)
        await instance.setBaseURI("https://sample.com/")
        await instance.setKeccakPrefix("Ex_")

        const now = Math.floor(Date.now() / 1000)
        await instance.setRevealTimestamp(now)

        await instance.adminMint(5)

        const hash = keccak256(toUtf8Bytes("Ex_3"))
        expect(hash.startsWith("0x")).to.be.true
        const name = hash.substring(2)

        expect(await instance.tokenURI(3))
            .to.equal(`https://sample.com/${name}.json`)
    })
})