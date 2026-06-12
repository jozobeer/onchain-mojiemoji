import { getBytes } from "ethers"
import env, { ethers, upgrades } from "hardhat"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { seedDictionary } from "../libraries/dictionarySeed"
import HardhatRuntimeUtility from "../libraries/HardhatRuntimeUtility"

async function main() {
    const util = new HardhatRuntimeUtility(env)
    if (await util.isProxyDeployed())
        throw Error("A proxy is already deployed. Delete .openzeppelin/<network>.json to redeploy from scratch.")

    const wordsHex: string[] = JSON.parse(readFileSync(resolve(__dirname, "..", "data", "initial-words.json"), "utf8"))
    const words = wordsHex.map(getBytes)

    const dictFactory = await ethers.getContractFactory("Dictionary")
    // EIP-3860: pass empty array — seed via addWords chunks (see libraries/dictionarySeed.ts)
    const dict = await upgrades.deployProxy(dictFactory, [[]], { kind: "uups" })
    await dict.waitForDeployment()

    const address = await dict.getAddress()
    console.info("Dictionary deployed to:", address)

    const { chunksSubmitted } = await seedDictionary(dict, words)
    console.info(`Seeded ${words.length} words in ${chunksSubmitted} chunk(s)`)
    console.info("Next step: pnpm run deploy:sepolia")
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
