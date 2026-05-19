import { formatEther } from 'ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

export default async (arg: any, env: HardhatRuntimeEnvironment) => {
    const [deployer] = await env.ethers.getSigners()
    const balance = await env.ethers.provider.getBalance(deployer)
    const ether = formatEther(balance)
    console.info(`${ether} ETH (${balance} wei) in ${deployer.address}`)
}
