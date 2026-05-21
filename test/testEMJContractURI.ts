import { expect } from "chai"

import { describe, it } from "mocha"

import { deployFreshEMJ } from "../libraries/const"

describe("EMJ Contract URI", () => {
    it("Check contractURI", async () => {
        const instance = await deployFreshEMJ()

        await instance.setBaseURI("https://test.com/")
        expect(await instance.contractURI()).to.equal("https://test.com/index.json")
    })
})
