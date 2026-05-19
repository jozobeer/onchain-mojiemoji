import { HardhatRuntimeEnvironment } from 'hardhat/types'
import HardhatRuntimeUtility from '../libraries/HardhatRuntimeUtility'

export default async (arg: any, env: HardhatRuntimeEnvironment) => {
    const util = new HardhatRuntimeUtility(env)
    const proxy = await util.deployedProxy()
    console.info(`deployed proxy address: ${proxy.address}`)
}
