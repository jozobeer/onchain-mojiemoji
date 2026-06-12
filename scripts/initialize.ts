import { ZeroAddress, parseEther } from "ethers"
import env, { ethers } from "hardhat"

import { LatestEMJ, latestEMJFactory } from "../libraries/const"
import HardhatRuntimeUtility from "../libraries/HardhatRuntimeUtility"

// ─── Configure these before running ───────────────────────────────────────────
// All values below are placeholders. Review and update before each deploy.

/** Base URI for token metadata. Must end with a slash. */
const BASE_URI = "https://emj-nft.com/"

const MINT_LIMIT = 1000
const ALLOWLISTED_MEMBER_MINT_LIMIT = 3

// ISO 8601, UTC. Set to the actual campaign schedule before running.
const PUBLIC_MINT_START = new Date("2026-01-01T00:00:00Z")
const PUBLIC_MINT_END = new Date("2026-01-31T23:59:59Z")
const ALLOWLIST_MINT_START = new Date("2026-01-01T00:00:00Z")
const ALLOWLIST_MINT_END = new Date("2026-01-31T23:59:59Z")

const PUBLIC_MINT_PRICE = parseEther("0.01")
const ALLOWLIST_MINT_PRICE = parseEther("0.005")

/** EIP-2981 royalty fraction in basis points (500 = 5%). */
const ROYALTY_FRACTION = 500

const requireAddress = (envVar: string): string => {
    const value = process.env[envVar]
    if (!value || value === ZeroAddress) throw new Error(`${envVar} must be set to a non-zero address`)
    return value
}

/** Address that receives EIP-2981 royalty payments. Must be set before running. */
const ROYALTY_RECEIVER = requireAddress("ROYALTY_RECEIVER")

/** Address that receives withdrawal proceeds. Must be set before running. */
const WITHDRAWAL_RECEIVER = requireAddress("WITHDRAWAL_RECEIVER")
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
    const util = new HardhatRuntimeUtility(env)
    const factory = await latestEMJFactory
    const instance = factory.attach((await util.deployedProxy()).address) as LatestEMJ

    const [deployer] = await ethers.getSigners()
    let nonce = await ethers.provider.getTransactionCount(deployer.address)

    ///////////////////////////////////////////////////////////////////
    //// Base URI
    ///////////////////////////////////////////////////////////////////

    await instance.setBaseURI(BASE_URI, { nonce: nonce++ })

    ///////////////////////////////////////////////////////////////////
    //// Minting limit
    ///////////////////////////////////////////////////////////////////

    await instance.setMintLimit(MINT_LIMIT, { nonce: nonce++ })
    await instance.setAllowlistedMemberMintLimit(ALLOWLISTED_MEMBER_MINT_LIMIT, { nonce: nonce++ })

    ///////////////////////////////////////////////////////////////////
    //// Public minting period
    ///////////////////////////////////////////////////////////////////

    await instance.setPublicMintAvailablePeriod(
        Math.floor(PUBLIC_MINT_START.getTime() / 1000),
        Math.floor(PUBLIC_MINT_END.getTime() / 1000),
        { nonce: nonce++ },
    )

    ///////////////////////////////////////////////////////////////////
    //// Allowlist minting period
    ///////////////////////////////////////////////////////////////////

    await instance.setAllowlistMintAvailablePeriod(
        Math.floor(ALLOWLIST_MINT_START.getTime() / 1000),
        Math.floor(ALLOWLIST_MINT_END.getTime() / 1000),
        { nonce: nonce++ },
    )

    ///////////////////////////////////////////////////////////////////
    //// Pricing
    ///////////////////////////////////////////////////////////////////

    await instance.setPublicMintPrice(PUBLIC_MINT_PRICE, { nonce: nonce++ })
    await instance.setAllowlistMintPrice(ALLOWLIST_MINT_PRICE, { nonce: nonce++ })

    ///////////////////////////////////////////////////////////////////
    //// Royalty
    ///////////////////////////////////////////////////////////////////

    await instance.setRoyaltyFraction(ROYALTY_FRACTION, { nonce: nonce++ })
    await instance.setRoyaltyReceiver(ROYALTY_RECEIVER, { nonce: nonce++ })

    ///////////////////////////////////////////////////////////////////
    //// Withdrawal
    ///////////////////////////////////////////////////////////////////

    await instance.setWithdrawalReceiver(WITHDRAWAL_RECEIVER, { nonce: nonce++ })
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
