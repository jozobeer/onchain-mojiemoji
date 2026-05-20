import { expect } from "chai"
import { encodeBytes32String } from "ethers"
import { upgrades } from "hardhat"
import { describe, it } from "mocha"

import { LatestEMJ, latestEMJFactory } from "../libraries/const"

describe("EMJ TokenURI", () => {
    it("Check if TokenURI doesn't end with slash, the value will be reverted", async () => {
        const instance = (await upgrades.deployProxy(await latestEMJFactory)) as LatestEMJ
        // URI ends with slash is ok
        await expect(instance.setBaseURI("https://sample.com/")).to.not.be.reverted
        // but URI without slash is not ok
        await expect(instance.setBaseURI("https://sample.com")).to.be.revertedWith("invalid suffix")
    })

    it("Returns mojiemoji URL composed from on-chain bytes32 text Param", async () => {
        const instance = (await upgrades.deployProxy(await latestEMJFactory)) as LatestEMJ
        await instance.setMintLimit(10)
        await instance.adminMint(1)
        await instance.setStampText(1, encodeBytes32String("勝利"))

        expect(await instance.tokenURI(1)).to.equal(`https://mojiemoji.jozo.beer/?text=${encodeURIComponent("勝利")}`)
    })
})
