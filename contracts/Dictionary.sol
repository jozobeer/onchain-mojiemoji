// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

/**
 * @title Dictionary
 * @notice Append-only word list backing the mojiemoji NFT vocabulary.
 *         Each element is a UTF-8 raw bytes payload representing one complete
 *         word. Validation / dedup / length-cap is the responsibility of the
 *         off-chain sanitizer (TypeScript) — this contract is a dumb data store
 *         per ADR-0002 §6.
 * @dev    Mutator surface (`setWord` / `removeWord`) is intentionally absent
 *         from the ABI. To anchor the append-only invariant at the contract
 *         level (Dream: permanence), the owner can call `freeze()` once —
 *         after which `_authorizeUpgrade` reverts unconditionally, so no
 *         future implementation can introduce mutators. See ADR-0003.
 *         `addWords` / `transferOwnership` remain available after freeze;
 *         only upgrade authority is sealed.
 */
contract Dictionary is Initializable, UUPSUpgradeable, Ownable2StepUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @dev append-only word list.
    bytes[] private _words;

    /// @dev One-way kill switch for the UUPS upgrade path (ADR-0003).
    bool public frozen;

    event WordsAdded(uint256 indexed startIndex, uint256 count);
    event UpgradesFrozen();

    /**
     * @notice Seeds the Dictionary with an initial vocabulary.
     * @dev    Mainnet deployment must pass an EMPTY array here and seed the
     *         vocabulary with subsequent `addWords` calls. EIP-3860 caps init
     *         code at 49152 bytes (post-Shanghai), and the production seed
     *         (~2243 UTF-8 words) overruns that limit when passed inline.
     *         The production protocol is:
     *           1. deploy via `initialize([])`
     *           2. owner submits `addWords(chunk_1) ... addWords(chunk_N)`
     *              (see libraries/dictionarySeed.ts — Issue #30)
     *           3. owner calls `freeze()` to seal the upgrade path (ADR-0003)
     *         The non-empty form is preserved for local fixtures / unit tests
     *         where vocab is small enough to fit in init code.
     */
    function initialize(bytes[] calldata initialWords) external initializer {
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        _appendWords(initialWords);
    }

    function wordAt(uint256 index) external view returns (bytes memory) {
        return _words[index];
    }

    function wordCount() external view returns (uint256) {
        return _words.length;
    }

    function addWords(bytes[] calldata words) external onlyOwner {
        _appendWords(words);
    }

    /**
     * @notice One-way switch that disables UUPS upgrades forever. Once frozen,
     *         this contract's implementation is permanent — no future
     *         implementation can introduce mutators or alter behavior. There
     *         is intentionally no unfreeze path. See ADR-0003.
     */
    function freeze() external onlyOwner {
        require(!frozen, "already frozen");
        frozen = true;
        emit UpgradesFrozen();
    }

    function _appendWords(bytes[] calldata words) internal {
        uint256 startIndex = _words.length;
        for (uint256 i = 0; i < words.length; ++i) {
            _words.push(words[i]);
        }
        emit WordsAdded(startIndex, words.length);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {
        require(!frozen, "upgrades frozen");
    }
}
