import { expect } from "chai"

import { describe, it } from "mocha"

import { deployFreshEMJ } from "../libraries/const"

describe("EMJ SupportsInterface (ERC165)", () => {
    it("Check if the contract supports ERC165", async () => {
        const instance = await deployFreshEMJ()
        expect(await instance.supportsInterface("0x01ffc9a7")).to.be.true
    })

    it("Check if the contract supports ERC721", async () => {
        const instance = await deployFreshEMJ()
        expect(await instance.supportsInterface("0x80ac58cd")).to.be.true
    })

    it("Check if the contract supports ERC721Enumerable", async () => {
        const instance = await deployFreshEMJ()
        expect(await instance.supportsInterface("0x780e9d63")).to.be.true
    })

    it("Check if the contract supports ERC721Metadata", async () => {
        const instance = await deployFreshEMJ()
        expect(await instance.supportsInterface("0x5b5e139f")).to.be.true
    })

    it("Check if the contract supports ERC2981", async () => {
        const instance = await deployFreshEMJ()
        expect(await instance.supportsInterface("0x2a55205a")).to.be.true
    })

    it("Check if the contract doesn't support unknown interface", async () => {
        const instance = await deployFreshEMJ()
        expect(await instance.supportsInterface("0xffffffff")).to.be.false
    })
})
