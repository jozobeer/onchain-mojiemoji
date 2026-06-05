// Local-net smoke test for ADR-0004 (on-chain JSON metadata).
//
// Boots an in-process hardhat network, deploys Dictionary (UUPS) + EMJ
// (Transparent) proxies, wires them together, mints a few tokens, then decodes the
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

// The mojiemoji.jozo.beer endpoint 403s default (node / urllib) User-Agents,
// so a browser UA is required to fetch the rendered Stamp.
const BROWSER_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// Cap each image fetch so a stalled endpoint (or DNS/network failure) surfaces
// as a deterministic error instead of hanging the smoke (and CI) indefinitely.
const IMAGE_FETCH_TIMEOUT_MS = 10_000

// ADR-0005 regression guard: the `image` field MUST resolve to an actual image
// (Content-Type: image/*). The retired `/?text=` form returned the HTML SPA
// shell (text/html), which is exactly the bug this fix closes — so a text/html
// response here means the metadata regressed back to the broken URL form.
const assertImage = async (url: string, label: string): Promise<void> => {
    const res = await fetch(url, {
        headers: { "User-Agent": BROWSER_UA },
        signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    }).catch((cause) => {
        throw new Error(`${label}: fetch failed (timeout ${IMAGE_FETCH_TIMEOUT_MS}ms / network) — ${url}: ${cause}`)
    })
    const contentType = res.headers.get("content-type") ?? ""
    if (!res.ok || !contentType.startsWith("image/")) {
        throw new Error(`${label}: expected HTTP 200 image/*, got HTTP ${res.status} "${contentType}" — ${url}`)
    }
    console.log(`  ✓ ${label}: HTTP ${res.status} ${contentType}`)
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

    const tokenMetas = await Promise.all(
        [1, 2, 3].map(async (tokenId) => decode((await emj.tokenURI(tokenId)) as string) as Record<string, unknown>),
    )
    tokenMetas.forEach((meta, i) => {
        console.log(`\n--- tokenURI(${i + 1}) ---`)
        console.log(JSON.stringify(meta, null, 2))
    })

    // ADR-0005 end-to-end proof: every `image` field must resolve to a live
    // image/* response, not the legacy text/html SPA shell. Independent URLs,
    // so the content-type checks run concurrently.
    console.log(`\n--- live image Content-Type checks (ADR-0005) ---`)
    const imageChecks = [
        assertImage(cMeta.image as string, "contractURI.image"),
        ...tokenMetas.map((meta, i) => assertImage(meta.image as string, `tokenURI(${i + 1}).image`)),
    ]
    await Promise.all(imageChecks)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
