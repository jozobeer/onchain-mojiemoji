import { expect } from "chai"
import { ethers } from "hardhat"
import { describe, it } from "mocha"

import { deployFreshEMJ } from "../libraries/const"

// ADR-0002 では tokenURI が baseURI を使わなくなったが、contractURI は依然
// baseURI を参照する (`<baseURI>index.json`)。setBaseURI の "末尾 `/` 必須"
// validation はその経路を守るため残っている。本テストはその不変条件を pin する。
describe("EMJ baseURI", () => {
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

    it("setBaseURI propagates to contractURI (`<baseURI>index.json`)", async () => {
        const emj = await deployFreshEMJ()
        await emj.setBaseURI("https://example.com/")
        expect(await emj.contractURI()).to.equal("https://example.com/index.json")
    })
})
