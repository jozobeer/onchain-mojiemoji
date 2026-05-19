import env, { upgrades } from 'hardhat'

import { latestEMJFactory } from '../libraries/const'
import HardhatRuntimeUtility from '../libraries/HardhatRuntimeUtility'

async function main() {
    const util = new HardhatRuntimeUtility(env)
    const proxy = await util.deployedProxy()
    const instance = await upgrades.upgradeProxy(proxy.address, await latestEMJFactory)
    await instance.deployed()
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
