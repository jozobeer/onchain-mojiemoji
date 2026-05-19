import { expect } from 'chai'
import { encodeBytes32String, keccak256, toUtf8Bytes } from 'ethers'
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

    // Dream 仕様 ─ mojiemoji.jozo.beer URL のオンチェーン動的合成
    // 既存 4 ケース（baseURI suffix / revealTimestamp / keccak hex JSON）は
    // この仕様への置き換えで陳腐化する。整理は後続サイクル。
    //
    // setStampText は EMJ.sol にまだ存在しない。typechain の `LatestEMJ` には未収録なので、
    // tdd-impl サイクルで contract に追加されると typechain 再生成で型が通る ─
    // この intersection 型はテスト側に「駆動したい API の形」を仕様として残す役割。
    type WithStampSetter = LatestEMJ & {
        setStampText: (tokenId: bigint | number, text: string) => Promise<unknown>
    }
    it("Returns mojiemoji URL composed from on-chain bytes32 text Param", async () => {
        const instance = await upgrades.deployProxy(await latestEMJFactory) as unknown as WithStampSetter
        await instance.setMintLimit(10)
        await instance.adminMint(1)
        await instance.setStampText(1, encodeBytes32String("勝利"))

        expect(await instance.tokenURI(1))
            .to.equal(`https://mojiemoji.jozo.beer/?text=${encodeURIComponent("勝利")}`)
    })
})