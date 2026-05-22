import { expect } from "chai"
import { ethers } from "hardhat"
import { describe, it } from "mocha"

import { deployFreshEMJ } from "../libraries/const"

// ADR-0004 以降、baseURI は dead state (contractURI / tokenURI のどちらからも
// 読まれない)。storage layout 互換性のためスロットと setter は残しているので、
// 読み書きの不変条件のみ pin する。contractURI 連動の検証は testEMJContractURI.ts
// 側の "baseURI decoupling" セクションが担当。
describe("EMJ baseURI (dead state, retained for storage layout compatibility)", () => {
    it("Defaults baseURI to `/` after initialize", async () => {
        const emj = await deployFreshEMJ()
        expect(await emj.baseURI()).to.equal("/")
    })

    it("Accepts a URL ending with `/`", async () => {
        const emj = await deployFreshEMJ()
        await emj.setBaseURI("https://example.com/")
        expect(await emj.baseURI()).to.equal("https://example.com/")
    })

    it("Accepts an empty string (checkSuffix allows zero-length input)", async () => {
        const emj = await deployFreshEMJ()
        await emj.setBaseURI("")
        expect(await emj.baseURI()).to.equal("")
    })

    it("Reverts with `invalid suffix` when the URL does not end with `/`", async () => {
        const emj = await deployFreshEMJ()
        await expect(emj.setBaseURI("https://example.com")).to.be.revertedWith("invalid suffix")
    })

    it("Reverts when a non-owner calls setBaseURI", async () => {
        const [, alice] = await ethers.getSigners()
        const emj = await deployFreshEMJ()
        await expect(emj.connect(alice).setBaseURI("https://example.com/")).to.be.revertedWith(
            "Ownable: caller is not the owner",
        )
    })
})
