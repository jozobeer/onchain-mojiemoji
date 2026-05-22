// Local-net smoke test for ADR-0004 (on-chain JSON metadata).
//
// Boots an in-process hardhat network, deploys Dictionary + EMJ as UUPS
// proxies, wires them together, mints a few tokens, then decodes the
// data:application/json;base64,... payload from tokenURI(1..N) and
// contractURI() to verify the OpenSea-standard JSON shape end-to-end.
//
// Run:  pnpm exec hardhat run scripts/smoke-onchain-json.ts --network hardhat

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { Contract, getBytes } from "ethers"
import { ethers, upgrades } from "hardhat"

import { DEFAULT_CHUNK_SIZE, seedDictionary } from "../libraries/dictionarySeed"

const DATA_URI_PREFIX = "data:application/json;base64,"

const decode = (uri: string): unknown => {
    if (!uri.startsWith(DATA_URI_PREFIX)) {
        throw new Error(`unexpected URI prefix: ${uri.slice(0, 80)}`)
    }
    return JSON.parse(Buffer.from(uri.slice(DATA_URI_PREFIX.length), "base64").toString("utf8"))
}

// EIP-3860 caps init code at 49152 bytes, so the full 2243-word vocabulary
// can't be passed to `Dictionary.initialize(bytes[])` in a single deploy tx.
// This smoke exercises the mainnet-realistic shape: `initialize([])` plus
// chunked `addWords` calls via libraries/dictionarySeed.
const loadFullVocabulary = (): Uint8Array[] => {
    const path = resolve(__dirname, "..", "data", "initial-words.json")
    return (JSON.parse(readFileSync(path, "utf8")) as string[]).map((h) => getBytes(h))
}

async function main() {
    const [deployer] = await ethers.getSigners()
    console.log(`deployer: ${deployer.address}`)

    const initialWords = loadFullVocabulary()
    console.log(`Dictionary vocabulary size: ${initialWords.length}`)

    const DictFactory = await ethers.getContractFactory("Dictionary")
    const dict = (await upgrades.deployProxy(DictFactory, [[]], { kind: "uups" })) as unknown as Contract
    await dict.waitForDeployment()
    const seed = await seedDictionary(dict, initialWords)
    console.log(
        `chunked seed: ${seed.chunksSubmitted} chunks (chunkSize=${DEFAULT_CHUNK_SIZE}), ` +
            `gas per chunk min/max = ${seed.chunkGasUsed.reduce((a, b) => (a < b ? a : b), seed.chunkGasUsed[0] ?? 0n)} / ` +
            `${seed.chunkGasUsed.reduce((a, b) => (a > b ? a : b), 0n)}`,
    )
    const dictAddr = await dict.getAddress()
    console.log(`Dictionary proxy: ${dictAddr}`)

    const EMJFactory = await ethers.getContractFactory("EMJ")
    const emj = await upgrades.deployProxy(EMJFactory)
    await emj.waitForDeployment()
    const emjAddr = await emj.getAddress()
    console.log(`EMJ proxy: ${emjAddr}`)

    await (await emj.setMintLimit(1000)).wait()
    await (await emj.setDictionary(dictAddr)).wait()
    await (await emj.adminMint(3)).wait()
    console.log(`minted: tokenId 1..3`)

    const cURI = (await emj.contractURI()) as string
    const cMeta = decode(cURI) as Record<string, unknown>
    console.log(`\n--- contractURI ---`)
    console.log(JSON.stringify(cMeta, null, 2))

    for (const tokenId of [1, 2, 3]) {
        const uri = (await emj.tokenURI(tokenId)) as string
        const meta = decode(uri) as Record<string, unknown>
        console.log(`\n--- tokenURI(${tokenId}) ---`)
        console.log(JSON.stringify(meta, null, 2))
    }
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
