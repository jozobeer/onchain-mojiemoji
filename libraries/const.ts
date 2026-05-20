import { Contract } from "ethers"
import { ethers } from "hardhat"

import { EMJ } from "../typechain-types/contracts/EMJ"

export const latestEMJFactory = ethers.getContractFactory("EMJ")
export type LatestEMJ = EMJ & Contract
