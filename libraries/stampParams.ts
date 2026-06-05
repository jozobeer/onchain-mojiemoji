import { AbiCoder, encodeBytes32String, keccak256, toUtf8Bytes } from "ethers"

// Stamp Param derivation (ADR-0005) — TypeScript single-source-of-truth for the
// candidate sets, plus an INDEPENDENT re-implementation of the on-chain
// derivation used as a test/smoke oracle. The candidate arrays here MUST stay
// byte-identical (same values, same order) with contracts/StampParams.sol — the
// derivation tests assert the on-chain output against this oracle, so any drift
// between the two surfaces is caught immediately.
//
// Every value below was validated against the live mojiemoji.jozo.beer /emoji/
// endpoint (all return Content-Type: image/*). NOTE: an invalid `font` makes the
// endpoint return HTTP 400 (broken image), whereas an invalid `animation` only
// falls back to a static render — so font names in particular must match exactly.

export const EMOJI_BASE_URL = "https://mojiemoji.jozo.beer/emoji/"

// Domain-separation salt. Verified equal to Solidity `bytes32("EMJ_PARAM_V1")`.
export const PARAM_SALT = encodeBytes32String("EMJ_PARAM_V1")

// font: 16 candidates (4 bits). canonical 17 minus `noto-sans-jp` (near-dup of `noto`).
export const FONTS = [
    "gothic",
    "gothic-bold",
    "maru",
    "maru-bold",
    "mincho",
    "dela",
    "akzk",
    "zero",
    "kurobara",
    "hachimaru",
    "chikara",
    "tamanegi",
    "pixel",
    "toge",
    "rampart",
    "noto",
] as const

// color: 64 candidates (6 bits). dark-mode-safe HSL sweep (16 hue × 4 sat/light bands).
export const COLORS = [
    "ef6c6c",
    "ef9e6c",
    "efce6c",
    "ddef6c",
    "adef6c",
    "7bef6c",
    "6cef8d",
    "6cefbf",
    "6cefef",
    "6cbdef",
    "6c8def",
    "7e6cef",
    "ad6cef",
    "df6cef",
    "ef6cce",
    "ef6c9c",
    "f23636",
    "f27e36",
    "f2c336",
    "d9f236",
    "94f236",
    "4cf236",
    "36f265",
    "36f2ad",
    "36f2f2",
    "36aaf2",
    "3665f2",
    "4f36f2",
    "9436f2",
    "dc36f2",
    "f236c3",
    "f2367b",
    "f50a0a",
    "f5640a",
    "f5ba0a",
    "d6f50a",
    "80f50a",
    "26f50a",
    "0af545",
    "0af59f",
    "0af5f5",
    "0a9bf5",
    "0a45f5",
    "290af5",
    "800af5",
    "d90af5",
    "f50aba",
    "f50a60",
    "bf1818",
    "bf5818",
    "bf9518",
    "a8bf18",
    "6bbf18",
    "2bbf18",
    "18bf41",
    "18bf81",
    "18bfbf",
    "187fbf",
    "1841bf",
    "2e18bf",
    "6b18bf",
    "ab18bf",
    "bf1895",
    "bf1855",
] as const

// animation: 32 candidates (5 bits). canonical 34 minus `bakusan` (block-only,
// obscures letterforms) and `kirari` (near-dup of `kira`).
export const ANIMATIONS = [
    "tate_scroll",
    "yoko_scroll",
    "ekken",
    "tate_ekken",
    "bane",
    "gatagata",
    "bure",
    "chuuou_zoom",
    "kira",
    "tenmetsu",
    "shuchusen",
    "kaiten",
    "neruneru",
    "patapata",
    "yurayura",
    "mabataki",
    "norinori",
    "mochimochi",
    "mozaiku",
    "poyoon",
    "yatta",
    "tatemoya",
    "nami",
    "yokomoya",
    "zairu",
    "zanzo",
    "chirichiri",
    "disco",
    "psycho",
    "kage_kaiten",
    "kage_bokashi",
    "kage_neon",
] as const

// speed: 4 candidates (2 bits).
export const SPEEDS = ["step", "slow", "normal", "fast"] as const

// contractURI curated (collection has no tokenId — ADR-0005 D5).
export const CONTRACT_IMAGE_WORD = "絵"
export const CONTRACT_PARAMS = { font: "dela", color: "f59e0b", animation: "kira", speed: "normal" } as const

export type StampParams = { font: string; color: string; animation: string; speed: string }

// RFC 3986 percent-encode — mirrors EMJ.sol `_percentEncode` (uppercase hex,
// unreserved = [A-Za-z0-9\-._~] pass through). JS encodeURIComponent diverges on
// `!'()*` (treats them as unreserved), so the rule is re-implemented byte-exact.
export const percentEncode = (text: string): string => {
    const isUnreserved = (b: number): boolean =>
        (b >= 0x30 && b <= 0x39) ||
        (b >= 0x41 && b <= 0x5a) ||
        (b >= 0x61 && b <= 0x7a) ||
        b === 0x2d ||
        b === 0x2e ||
        b === 0x5f ||
        b === 0x7e
    return Array.from(toUtf8Bytes(text))
        .map((b) => (isUnreserved(b) ? String.fromCharCode(b) : `%${b.toString(16).toUpperCase().padStart(2, "0")}`))
        .join("")
}

// Independent oracle: derive (font, color, animation, speed) from tokenId.
// ph = keccak256(abi.encode(PARAM_SALT, tokenId)); power-of-two masks → uniform,
// no modulo bias, no out-of-bounds.
export const deriveStampParams = (tokenId: bigint | number): StampParams => {
    const ph = BigInt(
        keccak256(AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [PARAM_SALT, BigInt(tokenId)])),
    )
    return {
        font: FONTS[Number(ph & 0xfn)],
        color: COLORS[Number((ph >> 4n) & 0x3fn)],
        animation: ANIMATIONS[Number((ph >> 10n) & 0x1fn)],
        speed: SPEEDS[Number((ph >> 15n) & 0x3n)],
    }
}

const paramQuery = ({ font, color, animation, speed }: StampParams): string =>
    `font=${font}&color=${color}&animation=${animation}&speed=${speed}`

// Full token image URL (the value placed in the JSON `image` field).
export const stampImageUrl = (word: string, tokenId: bigint | number): string =>
    `${EMOJI_BASE_URL}${percentEncode(word)}?${paramQuery(deriveStampParams(tokenId))}`

// Full collection image URL (contractURI — curated, deterministic, tokenId-free).
export const contractImageUrl = (): string =>
    `${EMOJI_BASE_URL}${percentEncode(CONTRACT_IMAGE_WORD)}?${paramQuery(CONTRACT_PARAMS)}`
