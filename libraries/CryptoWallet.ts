import { randomBytes } from 'crypto'
import { BitcoinAddress, EthereumAddress, HDKey, Mnemonic } from 'wallet.ts'

export default class {
    ethereumAddress: string
    bitcoinAddress: string
    mnemonicPhrase: string
    privateKey: string

    constructor() {
        // Generate seed
        const entropy = randomBytes(32)
        const mnemonic = Mnemonic.generate(entropy)
        this.mnemonicPhrase = mnemonic.phrase
        const seed = mnemonic.toSeed()
        // Build keys
        const masterKey = HDKey.parseMasterSeed(seed)
        const extendedPrivateKey = masterKey.derive("m/44'/60'/0'/0").extendedPrivateKey || ""
        const childKey = HDKey.parseExtendedKey(extendedPrivateKey)
        // Get wallet
        const wallet = childKey.derive("0")
        this.privateKey = wallet.privateKey?.toString("hex") || ""
        // Addresses
        this.ethereumAddress = EthereumAddress.checksumAddress(EthereumAddress.from(wallet.publicKey).address)
        this.bitcoinAddress = BitcoinAddress.from(wallet.publicKey).address
    }
}