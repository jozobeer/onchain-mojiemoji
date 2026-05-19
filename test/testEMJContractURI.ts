import { expect } from 'chai'
import { upgrades } from 'hardhat'
import { describe, it } from 'mocha'

import { LatestEMJ, latestEMJFactory } from '../libraries/const'

describe("EMJ Contract URI", () => {
    it("Check contractURI", async () => {
        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ

        await instance.setBaseURI("https://test.com/")
        expect(await instance.contractURI()).to.equal("https://test.com/index.json")
    })
})
