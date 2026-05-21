// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title IDictionary
 * @notice Read-only view of the on-chain word list backing EMJ tokenURI derivation.
 *         EMJ reads `wordAt` / `wordCount` but never writes — appending words is
 *         handled by the Dictionary owner directly (see contracts/Dictionary.sol).
 */
interface IDictionary {
    function wordAt(uint256 index) external view returns (bytes memory);

    function wordCount() external view returns (uint256);
}
