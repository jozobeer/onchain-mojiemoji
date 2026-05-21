import { Contract, toUtf8Bytes } from "ethers"
import { ethers, upgrades } from "hardhat"

import { EMJ } from "../typechain-types/contracts/EMJ"

export const latestEMJFactory = ethers.getContractFactory("EMJ")
export type LatestEMJ = EMJ & Contract

// Per ADR-0002, EMJ.mint reverts unless a non-empty Dictionary is wired up via
// setDictionary. Most legacy EMJ tests predate this dependency, so we expose a
// helper that deploys EMJ + a one-word Dictionary and links them. Tests that
// specifically exercise the unset / empty Dictionary paths (see
// testEMJTokenURIDictionary.ts) should NOT use this helper — they need to
// control the wiring themselves.
export const deployFreshEMJ = async (): Promise<LatestEMJ> => {
    const dictFactory = await ethers.getContractFactory("Dictionary")
    const dict = await upgrades.deployProxy(dictFactory, [[toUtf8Bytes("test")]], { kind: "uups" })
    const emj = (await upgrades.deployProxy(await latestEMJFactory)) as LatestEMJ
    await emj.setDictionary(await dict.getAddress())
    return emj
}
