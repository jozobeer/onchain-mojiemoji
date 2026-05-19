import { expect } from 'chai'
import { ethers, upgrades } from 'hardhat'
import { describe } from 'mocha'

import { LatestEMJ, latestEMJFactory } from '../libraries/const'

describe("Withdraw from EMJ", () => {
    it("Withdraw all", async () => {
        const [deployer] = await ethers.getSigners()

        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ

        await instance.setMintLimit(200)

        const mintPrice = await instance.publicMintPrice()
        const paid = mintPrice * 100n

        const balanceBeforePay = await ethers.provider.getBalance(deployer)
        await instance.publicMint(100, { value: paid })
        const balanceAfterPay = await ethers.provider.getBalance(deployer)

        expect(await ethers.provider.getBalance(instance)).to.equal(paid)
        expect(balanceBeforePay - balanceAfterPay).is.greaterThan(paid) // gt because of gas

        await instance.withdraw()
        const balanceAfterWithdraw = await ethers.provider.getBalance(deployer)

        expect(await ethers.provider.getBalance(instance)).to.equal(0)
        expect(balanceAfterWithdraw).is.greaterThan(balanceAfterPay)
        expect(balanceAfterWithdraw).is.lessThan(balanceBeforePay) // lt because of gas
    })

    it("Nobody can withdraw other than owner", async () => {
        const [, , , , , , , , mallory] = await ethers.getSigners()

        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ

        await instance.withdraw() // ok
        await expect(instance.connect(mallory).withdraw()).to.revertedWith("Ownable: caller is not the owner")
    })

    it("Withdrawal receiver receives all", async () => {
        const [, alice, , , , , , , ivan] = await ethers.getSigners()

        const factory = await latestEMJFactory
        const instance = await upgrades.deployProxy(factory) as LatestEMJ

        await instance.setMintLimit(200)

        const mintPrice = await instance.publicMintPrice()
        const paid = mintPrice * 100n
        await expect(await instance.connect(alice).publicMint(100, { value: paid }))
            .to.changeEtherBalances([instance, alice], [paid, -paid])


        await instance.setWithdrawalReceiver(ivan.address)
        await expect(await instance.withdraw())
            .to.changeEtherBalances([instance, ivan], [-paid, paid])

    })
})