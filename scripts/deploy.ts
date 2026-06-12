import env, { upgrades } from "hardhat"

import { LatestEMJ, latestEMJFactory } from "../libraries/const"
import HardhatRuntimeUtility from "../libraries/HardhatRuntimeUtility"

async function main() {
    const util = new HardhatRuntimeUtility(env)
    if (await util.isProxiesDeployed(2)) throw Error("EMJ proxy already deployed! Run 'upgrade' instead.")
    if (!(await util.isProxiesDeployed(1))) throw Error("Deploy Dictionary first: pnpm run deploy:dictionary:sepolia")

    const [{ address: dictAddress }] = await util.deployedProxies(1)

    const instance = (await upgrades.deployProxy(await latestEMJFactory)) as LatestEMJ
    await instance.deployed()

    await instance.setDictionary(dictAddress)

    console.log(await instance.name(), " is deployed to: ", instance.address)
    console.info(
        "Perform `hardhat run initialize` immediately after this! This contract has just been deployed and not been setup yet.",
    )
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
