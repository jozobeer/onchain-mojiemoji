import { HardhatRuntimeEnvironment } from "hardhat/types"

export default async (_args: unknown, env: HardhatRuntimeEnvironment) => {
    const network = await env.ethers.provider.getNetwork()
    const blockNumber = await env.ethers.provider.getBlockNumber()
    console.info(`Network : ${network.name}`)
    console.info(`chainId : ${network.chainId}`)
    console.info(`Block   : ${blockNumber}`)
}
