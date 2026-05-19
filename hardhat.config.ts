import '@nomicfoundation/hardhat-toolbox'
import '@openzeppelin/hardhat-upgrades'

import * as dotenv from 'dotenv'
import { parseEther } from 'ethers'
import { HardhatUserConfig, task } from 'hardhat/config'

import CryptoWallet from './libraries/CryptoWallet'
import checkBalanceTask from './tasks/checkBalanceTask'
import checkProxyAddressTask from './tasks/checkProxyAddressTask'
import exportHashedAllowlistJsonTask from './tasks/exportHashedAllowlistJsonTask'
import verifyTask from './tasks/verifyTask'

dotenv.config()

task("accounts")
  .setDescription("Prints the list of accounts")
  .setAction(async (args, env) => {
    const accounts = await env.ethers.getSigners()
    for (const account of accounts) console.log(account.address)
  })

task("balance")
  .setDescription("Prints the balance of an account")
  .setAction(checkBalanceTask)

task("proxyAddress")
  .setDescription("Prints the address of the deployed proxy")
  .setAction(checkProxyAddressTask)

task("vefityProxy")
  .setDescription("Verifies the deployed proxy")
  .setAction(verifyTask)

task("exportAllowlist")
  .setDescription("Export hashed-allowlist addresses to a JSON file")
  .setAction(exportHashedAllowlistJsonTask)

const accounts = [
  process.env.DEPROY_WALLET_PRIVATE_KEY,
].filter((elm?: string): elm is string => elm !== undefined)

const testAccounts = [
  process.env.TEST_WALLET_PRIVATE_KEY,
  ...Array.from({ length: 9 }, () => new CryptoWallet()).map((wallet) => wallet.privateKey),
].filter((elm?: string): elm is string => elm !== undefined)

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: testAccounts.map((privateKey) => ({
        privateKey, balance: parseEther("10000").toString()
      })),
    },
    // Ethereum networks
    mainnet: {
      url: process.env.MAINNET_URL || "",
      chainId: 1,
      accounts: accounts,
      timeout: 1000 * 60 * 5 // 5 minutes
    },
    sepolia: {
      url: process.env.SEPOLIA_URL || "",
      chainId: 11155111,
      accounts: testAccounts,
      timeout: 1000 * 60 * 5 // 5 minutes
    },
  },
  gasReporter: {
    enabled: true,
    currency: "JPY",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  sourcify: {
    enabled: true,
  },
  etherscan: {
    // Note: To see full list of supported networks, run `npx hardhat verify --list-networks`.
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY ?? "",
      sepolia: process.env.ETHERSCAN_API_KEY ?? "",
    },
  },
}

export default config
