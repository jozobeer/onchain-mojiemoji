// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 Yumenosuke Kokata

pragma solidity >=0.8;

interface IAllowlistMintable {
    /**
     * @notice emitted when allowlist minting price is changed
     * @param price new price of each token in allowlist minting
     */
    event AllowlistMintPriceChanged(uint256 price);

    /**
     * @notice emitted when allowlist minting period is changed
     * @param startTimestamp timestamp to start allowlist minting
     * @param endTimestamp timestamp to end allowlist minting
     */
    event AllowlistMintAvailablePeriodChanged(uint256 startTimestamp, uint256 endTimestamp);

    /**
     * @notice emitted when allowlist minting is executed
     */
    event AllowlistMinted(address to, uint256 startTokenId, uint256 amount);

    /**
     * @notice price of each token in allowlist minting
     */
    function allowlistMintPrice() external view returns (uint256);

    /**
     * @notice timestamp to allow allowlist minting
     */
    function allowlistMintStartTimestamp() external view returns (uint256);

    /**
     * @notice timestamp to end allowlist minting
     */
    function allowlistMintEndTimestamp() external view returns (uint256);

    /**
     * @notice token id of the last token that can be minted in allowlist minting
     */
    function allowlistMintLastTokenId() external view returns (uint256);

    /**
     * @notice check if the caller is allowlisted
     * @param merkleProof merkle proof to verify the allowlist
     */
    function isAllowlisted(bytes32[] calldata merkleProof) external view returns (bool);

    /**
     * @notice limit of tokens that can be minted by an allowlisted member
     */
    function allowlistedMemberMintLimit() external view returns (uint256);

    /**
     * @notice count of tokens that have been minted by an allowlisted member
     * @param member address of the allowlisted member
     */
    function allowlistMemberMintCount(address member) external view returns (uint256);

    /**
     * @notice mint tokens for allowlist sale
     * @param amount amount of tokens to mint
     * @param merkleProof merkle proof to verify the allowlist
     */
    function allowlistMint(uint256 amount, bytes32[] calldata merkleProof) external payable;
}
