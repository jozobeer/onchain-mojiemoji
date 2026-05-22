import { expect } from "chai"
import { ethers } from "hardhat"
import { describe, it } from "mocha"

import { deployFreshEMJ } from "../libraries/const"
import { decodeContractMetadata } from "./helpers/metadata"

// ADR-0004: contractURI returns `data:application/json;base64,<base64(JSON)>`
// where the decoded payload is OpenSea-standard collection-level metadata.
// The previous `baseURI + "index.json"` external-URL form is retired (Issue #28).

describe("EMJ ContractURI (OpenSea collection metadata)", () => {
    describe("Data URI envelope", () => {
        it("Returns a data:application/json;base64,... URI", async () => {
            const emj = await deployFreshEMJ()
            const uri = await emj.contractURI()
            expect(uri).to.match(/^data:application\/json;base64,/)
        })

        it("Decoded payload is valid JSON", async () => {
            const emj = await deployFreshEMJ()
            const uri = await emj.contractURI()
            const meta = decodeContractMetadata(uri)
            expect(meta).to.be.an("object")
        })
    })

    describe("Collection identity fields", () => {
        it("name is 'Onchain Mojiemoji'", async () => {
            const emj = await deployFreshEMJ()
            const meta = decodeContractMetadata(await emj.contractURI())
            expect(meta.name).to.equal("Onchain Mojiemoji")
        })

        it("description is a non-empty string", async () => {
            const emj = await deployFreshEMJ()
            const meta = decodeContractMetadata(await emj.contractURI())
            expect(meta.description).to.be.a("string")
            expect(meta.description.length).to.be.greaterThan(0)
        })

        it("external_link points to mojiemoji.jozo.beer root", async () => {
            const emj = await deployFreshEMJ()
            const meta = decodeContractMetadata(await emj.contractURI())
            expect(meta.external_link).to.equal("https://mojiemoji.jozo.beer/")
        })
    })

    describe("Image field — hardcoded representative word '絵' (ADR-0004 D2)", () => {
        it("image is a mojiemoji URL with percent-encoded '絵'", async () => {
            const emj = await deployFreshEMJ()
            const meta = decodeContractMetadata(await emj.contractURI())
            // "絵" in UTF-8 is 0xE7 0xB5 0xB5 → percent-encoded as "%E7%B5%B5"
            expect(meta.image).to.equal("https://mojiemoji.jozo.beer/?text=%E7%B5%B5")
        })

        it("image text param decodes back to '絵'", async () => {
            const emj = await deployFreshEMJ()
            const meta = decodeContractMetadata(await emj.contractURI())
            const u = new URL(meta.image)
            expect(u.searchParams.get("text")).to.equal("絵")
        })
    })

    describe("Royalty fields", () => {
        it("seller_fee_basis_points reflects _royaltyFraction (default 0)", async () => {
            const emj = await deployFreshEMJ()
            const meta = decodeContractMetadata(await emj.contractURI())
            expect(meta.seller_fee_basis_points).to.equal(0)
        })

        it("seller_fee_basis_points updates after setRoyaltyFraction", async () => {
            const emj = await deployFreshEMJ()
            await emj.setRoyaltyFraction(500)
            const meta = decodeContractMetadata(await emj.contractURI())
            expect(meta.seller_fee_basis_points).to.equal(500)
        })

        it("fee_recipient is the royalty receiver address (lowercased 0x-prefixed hex)", async () => {
            const [deployer] = await ethers.getSigners()
            const emj = await deployFreshEMJ()
            const meta = decodeContractMetadata(await emj.contractURI())
            expect(meta.fee_recipient.toLowerCase()).to.equal(deployer.address.toLowerCase())
        })

        it("fee_recipient updates after setRoyaltyReceiver", async () => {
            const [, , bob] = await ethers.getSigners()
            const emj = await deployFreshEMJ()
            await emj.setRoyaltyReceiver(bob.address)
            const meta = decodeContractMetadata(await emj.contractURI())
            expect(meta.fee_recipient.toLowerCase()).to.equal(bob.address.toLowerCase())
        })
    })

    describe("baseURI decoupling (ADR-0004 D1)", () => {
        it("contractURI ignores setBaseURI (baseURI is dead state)", async () => {
            const emj = await deployFreshEMJ()
            const before = await emj.contractURI()
            await emj.setBaseURI("https://example.com/")
            const after = await emj.contractURI()
            // contractURI no longer depends on baseURI — the data URI is identical.
            expect(after).to.equal(before)
        })
    })
})
