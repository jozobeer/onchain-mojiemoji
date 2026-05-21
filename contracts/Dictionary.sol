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
 *         from the ABI, so the append-only invariant cannot be broken by any
 *         caller against the *current* implementation. However, this contract
 *         is UUPS-upgradeable and `_authorizeUpgrade` is `onlyOwner`, so the
 *         owner can introduce mutators or otherwise change behavior via a
 *         future implementation. Constraining upgrade rights (multisig /
 *         timelock / freeze) is tracked separately and will be addressed in
 *         ADR-0003.
 */
contract Dictionary is Initializable, UUPSUpgradeable, Ownable2StepUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @dev append-only word list.
    bytes[] private _words;

    event WordsAdded(uint256 indexed startIndex, uint256 count);

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

    function _appendWords(bytes[] calldata words) internal {
        uint256 startIndex = _words.length;
        for (uint256 i = 0; i < words.length; ++i) {
            _words.push(words[i]);
        }
        emit WordsAdded(startIndex, words.length);
    }

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
