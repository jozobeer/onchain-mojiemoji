import { writeFileSync } from 'fs'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { join } from 'path'

import HardhatRuntimeUtility from '../libraries/HardhatRuntimeUtility'

export default async (arg: any, env: HardhatRuntimeEnvironment) => {
    const util = new HardhatRuntimeUtility(env)
    const data = `[\n${util.allowlistedAddresses().map(env.ethers.keccak256).map(s => `    "${s}"`).join(",\n")}\n]`
    const exportPath = join(__dirname, "allowlist.json")
    console.info(`writing a file to ${exportPath}`)
    writeFileSync(exportPath, data, { flag: "w" })
}