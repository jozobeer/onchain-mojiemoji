// SPDX-License-Identifier: MIT
pragma solidity >=0.8;

/**
 * @title StampParams
 * @dev ADR-0005 — deterministic Stamp Param derivation from a tokenId.
 *
 * `font` / `color` / `animation` / `speed` are derived from
 * `keccak256(abi.encode(_PARAM_SALT, tokenId))` via power-of-two bit masks, so
 * the distribution is uniform with no modulo bias and array indexing can never
 * go out of bounds (each mask exactly covers its candidate array).
 *
 * The salt domain-separates this derivation from the word-selection hash
 * (`keccak256(abi.encode(tokenId))`, ADR-0002), so Param and word are
 * independent. The whole library is pure with only in-memory candidate arrays —
 * it adds ZERO storage, keeping the importing upgradeable contract upgrade-safe
 * regardless of proxy kind.
 *
 * Every candidate value below was validated against the live mojiemoji.jozo.beer
 * `/emoji/` endpoint (all return Content-Type: image/*). NOTE: an invalid `font`
 * makes the endpoint return HTTP 400 (a broken image), whereas an invalid
 * `animation` only falls back to a static render — so `font` names in particular
 * must stay byte-exact. The candidate sets mirror libraries/stampParams.ts.
 *
 * Param            candidates  bits  shift  extraction
 * font             16          4     0      ph & 0xF
 * color            64          6     4      (ph >> 4) & 0x3F
 * animation        32          5     10     (ph >> 10) & 0x1F
 * speed            4           2     15     (ph >> 15) & 0x3
 */
library StampParams {
    bytes32 private constant _PARAM_SALT = "EMJ_PARAM_V1";

    /**
     * @dev Returns the URL query string `?font=...&color=...&animation=...&speed=...`
     * deterministically derived from `tokenId`. All Param values are URL-safe
     * ASCII (no percent-encoding needed).
     */
    function paramQuery(uint256 tokenId) internal pure returns (string memory) {
        uint256 ph = uint256(keccak256(abi.encode(_PARAM_SALT, tokenId)));
        return
            string(
                abi.encodePacked(
                    "?font=",
                    _fontAt(ph & 0xF),
                    "&color=",
                    _colorAt((ph >> 4) & 0x3F),
                    "&animation=",
                    _animationAt((ph >> 10) & 0x1F),
                    "&speed=",
                    _speedAt((ph >> 15) & 0x3)
                )
            );
    }

    /**
     * @dev Returns the OpenSea-trait JSON fragment for the four Stamp Params
     * deterministically derived from `tokenId`:
     *
     *   {"trait_type":"font","value":"..."},{"trait_type":"color","value":"..."},
     *   {"trait_type":"animation","value":"..."},{"trait_type":"speed","value":"..."}
     *
     * The fragment carries NO enclosing `[ ]` so callers can splice it into an
     * existing `attributes` array after a leading trait (e.g. `word`). The
     * Param values mirror `paramQuery` exactly (same derivation, same bare
     * values — `color` is the unprefixed hex), so the trait set and the image
     * URL's query string always agree. All Param values are URL-safe ASCII
     * identifiers (no `"`, `\`, or control bytes), so no JSON escaping is needed.
     */
    function attributesJson(uint256 tokenId) internal pure returns (string memory) {
        uint256 ph = uint256(keccak256(abi.encode(_PARAM_SALT, tokenId)));
        return
            string(
                abi.encodePacked(
                    '{"trait_type":"font","value":"',
                    _fontAt(ph & 0xF),
                    '"},{"trait_type":"color","value":"',
                    _colorAt((ph >> 4) & 0x3F),
                    '"},{"trait_type":"animation","value":"',
                    _animationAt((ph >> 10) & 0x1F),
                    '"},{"trait_type":"speed","value":"',
                    _speedAt((ph >> 15) & 0x3),
                    '"}'
                )
            );
    }

    function _fontAt(uint256 i) private pure returns (string memory) {
        string[16] memory fonts = [
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
            "noto"
        ];
        return fonts[i];
    }

    function _colorAt(uint256 i) private pure returns (string memory) {
        string[64] memory colors = [
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
            "bf1855"
        ];
        return colors[i];
    }

    function _animationAt(uint256 i) private pure returns (string memory) {
        string[32] memory animations = [
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
            "kage_neon"
        ];
        return animations[i];
    }

    function _speedAt(uint256 i) private pure returns (string memory) {
        string[4] memory speeds = ["step", "slow", "normal", "fast"];
        return speeds[i];
    }
}
