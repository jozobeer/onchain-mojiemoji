// Shared helpers for decoding `data:application/json;base64,<...>` URIs
// returned by EMJ's `tokenURI` / `contractURI` (ADR-0004). Lives in a
// side-effect-free module so test files can import the decoder without
// inadvertently registering each other's `describe(...)` blocks when run
// in isolation (e.g. `mocha test/testEMJContractURI.ts`).

export const DATA_URI_PREFIX = "data:application/json;base64,"

export interface TokenMetadata {
    name: string
    description: string
    image: string
    attributes: Array<{ trait_type: string; value: string }>
}

export interface ContractMetadata {
    name: string
    description: string
    image: string
    external_link: string
    seller_fee_basis_points: number
    fee_recipient: string
}

const decodeDataUri = (uri: string): string => {
    if (!uri.startsWith(DATA_URI_PREFIX)) {
        throw new Error(`expected data URI prefix, got: ${uri.slice(0, 64)}...`)
    }
    return Buffer.from(uri.slice(DATA_URI_PREFIX.length), "base64").toString("utf8")
}

export const decodeTokenMetadata = (uri: string): TokenMetadata =>
    JSON.parse(decodeDataUri(uri)) as TokenMetadata

export const decodeContractMetadata = (uri: string): ContractMetadata =>
    JSON.parse(decodeDataUri(uri)) as ContractMetadata
