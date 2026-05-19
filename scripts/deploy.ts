import env, { upgrades } from 'hardhat'

import { LatestEMJ, latestEMJFactory } from '../libraries/const'
import HardhatRuntimeUtility from '../libraries/HardhatRuntimeUtility'

async function main() {
  const util = new HardhatRuntimeUtility(env)
  if (await util.isProxyDeployed()) throw Error("Proxy has already been deployed! 'Upgrade' instead.")

  const instance = await upgrades.deployProxy(await latestEMJFactory) as LatestEMJ
  await instance.deployed()

  console.log(await instance.name(), " is deployed to: ", instance.address)
  console.info("Perform `hardhat run initialize` immediately after this! This contract has just been deployed and not been setup yet.")
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
