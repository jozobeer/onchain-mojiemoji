import { ZeroAddress } from 'ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

export type Proxie = {
    address: string
    txHash: string
    kind: string
}

export default class {
    private env: HardhatRuntimeEnvironment
    private addressRegex = /0x[\da-f]{40}/i

    constructor(env: HardhatRuntimeEnvironment) {
        this.env = env
    }

    public allowlistedAddresses = () => [...new Set(
        process.env.ALLOWLIST_ADDRESSES?.split("\n")
            .filter(address => this.addressRegex.test(address))
            .map(address => this.env.ethers.getAddress(address))
    )]

    public deployedProxies = async (numberOfProxies: number) => {
        const noProxyError = new Error("proxy is not deployed yet")
        try {
            await import(`../.openzeppelin/${this.networkFileName()}.json`)
        } catch {
            throw noProxyError
        }
        const json = await import(`../.openzeppelin/${this.networkFileName()}.json`)
        if (!json.proxies.length) throw noProxyError

        const proxies: Proxie[] = json.proxies
        return proxies.slice(-numberOfProxies)
    }

    public isProxiesDeployed = async (numberOfProxies: number) => {
        try {
            const proxies = await this.deployedProxies(numberOfProxies)

            // chain on localhost is disposable but json is left even the chain is discarded.
            // so need to check if the proxy is currently on chain.
            if (this.env.network.name == 'localhost') {
                const adminAddresses = await Promise.all(proxies.map(proxy => this.env.upgrades.erc1967.getAdminAddress(proxy.address)))
                return !adminAddresses.includes(ZeroAddress)
            }
            return true
        } catch {
            return false
        }
    }

    // If only one `Upgradeable` contract has been deployed, can use this function instead of deployedProxies.
    public deployedProxy = async () => (await this.deployedProxies(1))[0]

    // If only one `Upgradeable` contract has been deployed, can use this function instead of isProxiesDeployed.
    public isProxyDeployed = async () => this.isProxiesDeployed(1)

    private networkFileName = () => {
        if (this.env.network.name != 'localhost') return this.env.network.name
        const chainId = this.env.config.networks?.hardhat?.chainId || 1337
        return `unknown-${chainId}`
    }
}