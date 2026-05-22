/*
                                    SPDX-License-Identifier: MIT

███    ███ ██    ██  ███  ███  ████████  ███   ██   ░████░    ▒████▒   ██    ██  ██   ███  ████████ 
░██▒  ▒██░ ██    ██  ███  ███  ████████  ███   ██   ██████   ▒██████   ██    ██  ██  ▓██   ████████ 
 ███  ███  ██    ██  ███▒▒███  ██        ███▒  ██  ▒██  ██▒  ██▒  ▒█   ██    ██  ██ ▒██▒   ██       
  ██▒▒██   ██    ██  ███▓▓███  ██        ████  ██  ██▒  ▒██  ██        ██    ██  ██░██▒    ██       
  ▓████▓   ██    ██  ██▓██▓██  ██        ██▒█▒ ██  ██    ██  ███▒      ██    ██  █████     ██       
   ████    ██    ██  ██▒██▒██  ███████   ██ ██ ██  ██    ██  ▒█████▒   ██    ██  █████     ███████  
   ▒██▒    ██    ██  ██░██░██  ███████   ██ ██ ██  ██    ██   ░█████▒  ██    ██  █████▒    ███████  
    ██     ██    ██  ██ ██ ██  ██        ██ ▒█▒██  ██    ██      ▒███  ██    ██  ██▒▒██    ██       
    ██     ██    ██  ██    ██  ██        ██  ████  ██▒  ▒██        ██  ██    ██  ██  ██▓   ██       
    ██     ██▓  ▓██  ██    ██  ██        ██  ▒███  ▒██  ██▒  █▒░  ▒██  ██▓  ▓██  ██  ▒██   ██       
    ██     ▒██████▒  ██    ██  ████████  ██   ███   ██████   ███████▒  ▒██████▒  ██   ██▓  ████████ 
    ██      ▒████▒   ██    ██  ████████  ██   ███   ░████░   ░█████▒    ▒████▒   ██   ▒██  ████████ 

                            SPDX-FileCopyrightText: 2024 Yumenosuke Kokata
*/

pragma solidity >=0.8;

import {
    ERC721PsiBurnableUpgradeable,
    ERC721PsiUpgradeable
} from "@generald/erc721psi/contracts/extension/ERC721PsiBurnableUpgradeable.sol";
import {
    Ownable2StepUpgradeable,
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {
    IERC2981Upgradeable,
    IERC165Upgradeable
} from "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import {MerkleProofUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import {Base64Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/Base64Upgradeable.sol";
import {
    RevokableDefaultOperatorFiltererUpgradeable,
    RevokableOperatorFiltererUpgradeable
} from "operator-filter-registry/src/upgradeable/RevokableDefaultOperatorFiltererUpgradeable.sol";
import {IDictionary} from "./interfaces/IDictionary.sol";
import {IPublicMintable} from "./interfaces/IPublicMintable.sol";
import {IAllowlistMintable} from "./interfaces/IAllowlistMintable.sol";

contract EMJ is
    ERC721PsiBurnableUpgradeable,
    RevokableDefaultOperatorFiltererUpgradeable,
    Ownable2StepUpgradeable,
    IERC2981Upgradeable,
    IPublicMintable,
    IAllowlistMintable
{
    using MerkleProofUpgradeable for bytes32[];
    using StringsUpgradeable for uint256;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev initialize the contract.
     */
    function initialize() public initializer {
        __ERC721Psi_init("Onchain Mojiemoji", "EMJ");
        __RevokableDefaultOperatorFilterer_init();
        __Ownable2Step_init();

        // Set correct values from deploy script, below are just list of variables to remind us what to set!
        baseURI = "/";
        mintLimit = 0;
        publicMintStartTimestamp = 0; // already started
        publicMintEndTimestamp = type(uint256).max; // never ends
        allowlistMintStartTimestamp = 0; // already started
        allowlistMintEndTimestamp = type(uint256).max; // never ends
        publicMintPrice = 1 ether;
        allowlistMintPrice = 0.01 ether;
        allowlistedMemberMintLimit = 1;
        allowlistSaleId = 0;
        revealTimestamp = 0;
        _keccakPrefix = "EMJ_";
        _royaltyFraction = 0;
        _royaltyReceiver = msg.sender;
        _withdrawalReceiver = msg.sender;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721PsiUpgradeable, IERC165Upgradeable) returns (bool) {
        // We implemented ERC2981 by ourselves without inheriting one of the implementation that OpenZeppelin provides,
        // so we need to add it to the list of supported interfaces here.
        return interfaceId == type(IERC2981Upgradeable).interfaceId || super.supportsInterface(interfaceId);
    }

    function _startTokenId() internal pure virtual override returns (uint256) {
        return 1;
    }

    ///////////////////////////////////////////////////////////////////
    //// Ownable
    ///////////////////////////////////////////////////////////////////

    function owner()
        public
        view
        virtual
        override(OwnableUpgradeable, RevokableOperatorFiltererUpgradeable)
        returns (address)
    {
        // OperatorFilterer just needs to know who the owner is, so we return the owner from Ownable
        return OwnableUpgradeable.owner();
    }

    ///////////////////////////////////////////////////////////////////
    //// Apply Operator Filter
    ///////////////////////////////////////////////////////////////////

    function setApprovalForAll(address operator, bool approved) public override onlyAllowedOperatorApproval(operator) {
        super.setApprovalForAll(operator, approved);
    }

    function approve(address operator, uint256 tokenId) public override onlyAllowedOperatorApproval(operator) {
        super.approve(operator, tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) public override onlyAllowedOperator(from) {
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public override onlyAllowedOperator(from) {
        super.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override onlyAllowedOperator(from) {
        super.safeTransferFrom(from, to, tokenId, data);
    }

    ///////////////////////////////////////////////////////////////////
    //// ERC2981
    ///////////////////////////////////////////////////////////////////

    /**
     * @dev royalty fraction in percentage x 100. e.g. 5% should be 500.
     */
    uint96 private _royaltyFraction;

    /**
     * @dev set royalty in percentage x 100. e.g. 5% should be 500.
     */
    function setRoyaltyFraction(uint96 royaltyFraction) external onlyOwner {
        require(royaltyFraction <= 1_000, "royalty fraction exceeds the limit"); // 10%
        _royaltyFraction = royaltyFraction;
    }

    /**
     * @dev royalty receiver.
     */
    address private _royaltyReceiver;

    /**
     * @dev set royalty receiver.
     * @param receiver royalty receiver.
     */
    function setRoyaltyReceiver(address receiver) external onlyOwner {
        _royaltyReceiver = receiver;
    }

    /**
     * @dev get royalty info.
     * @param tokenId token id.
     * @param salePrice sale price.
     */
    function royaltyInfo(
        uint256 tokenId,
        uint256 salePrice
    ) external view override checkTokenIdExists(tokenId) returns (address receiver, uint256 royaltyAmount) {
        receiver = _royaltyReceiver;
        royaltyAmount = (salePrice * _royaltyFraction) / 10_000;
    }

    ///////////////////////////////////////////////////////////////////
    //// URI
    ///////////////////////////////////////////////////////////////////

    //////////////////////////////////
    //// Base URI (deprecated — kept for storage layout compatibility, ADR-0004)
    //////////////////////////////////

    /**
     * @dev DEPRECATED (ADR-0004 D1). No longer read by `tokenURI` / `contractURI`,
     * but the storage slot, setter, and `_baseURI()` override are retained for
     * UUPS storage layout compatibility and ERC721 metadata extension tooling
     * compatibility. Writing this slot has no effect on the metadata output.
     */
    string public baseURI;

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    /**
     * @dev set base URI.
     * @param baseURI_ base URI.
     */
    function setBaseURI(string memory baseURI_) external onlyOwner checkSuffix(baseURI_, "/") {
        baseURI = baseURI_;
    }

    /**
     * @dev check if the given string ends with the given suffix.
     * @param text string to check.
     * @param suffix suffix to check.
     */
    modifier checkSuffix(string memory text, bytes1 suffix) {
        bytes memory b = bytes(text);
        require(b.length == 0 || b[b.length - 1] == suffix, "invalid suffix");
        _;
    }

    //////////////////////////////////
    //// Contract URI (ADR-0004: on-chain JSON metadata)
    //////////////////////////////////

    /**
     * @dev Representative word for the collection-level image (ADR-0004 D2).
     * Hardcoded "絵" (e) — thematic because 絵 ≒ 絵文字 ≒ mojiemoji. Keeping it
     * `constant` avoids any extra storage slot and any post-deploy mutation
     * vector.
     */
    string private constant _CONTRACT_IMAGE_WORD = unicode"絵";

    string private constant _DESCRIPTION_TOKEN =
        "Onchain mojiemoji NFT. Each token derives a Japanese word from an on-chain Dictionary contract and renders it as an animated emoji image at mojiemoji.jozo.beer.";

    string private constant _DESCRIPTION_COLLECTION =
        "Onchain Mojiemoji: every token is a Japanese word picked deterministically from an on-chain, freezable Dictionary, rendered as an animated image via mojiemoji.jozo.beer.";

    /**
     * @dev Collection-level metadata — OpenSea-standard JSON returned as a
     * `data:application/json;base64,...` URI (ADR-0004). The image points to
     * mojiemoji.jozo.beer with the hardcoded representative word "絵".
     */
    function contractURI() public view returns (string memory) {
        string memory imageUrl = string(
            abi.encodePacked("https://mojiemoji.jozo.beer/?text=", _percentEncode(bytes(_CONTRACT_IMAGE_WORD)))
        );
        bytes memory json = abi.encodePacked(
            '{"name":"Onchain Mojiemoji"',
            ',"description":"',
            _DESCRIPTION_COLLECTION,
            '","image":"',
            imageUrl,
            '","external_link":"https://mojiemoji.jozo.beer/"',
            ',"seller_fee_basis_points":',
            uint256(_royaltyFraction).toString(),
            ',"fee_recipient":"',
            StringsUpgradeable.toHexString(_royaltyReceiver),
            '"}'
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64Upgradeable.encode(json)));
    }

    //////////////////////////////////
    //// Keccak Prefix
    //////////////////////////////////

    string private _keccakPrefix;

    /**
     * @dev set keccak prefix.
     * @param prefix keccak prefix.
     */
    function setKeccakPrefix(string memory prefix) external onlyOwner {
        _keccakPrefix = prefix;
    }

    //////////////////////////////////
    //// Reveal
    //////////////////////////////////

    event RevealTimestampChanged(uint256 timestamp);

    /**
     * @notice reveal timestamp.
     */
    uint256 public revealTimestamp;

    /**
     * @dev set reveal timestamp.
     * @param timestamp reveal timestamp.
     */
    function setRevealTimestamp(uint256 timestamp) external onlyOwner {
        revealTimestamp = timestamp;
        emit RevealTimestampChanged(timestamp);
    }

    ///////////////////////////////////////////////////////////////////
    //// Burning Tokens
    ///////////////////////////////////////////////////////////////////

    /**
     * @dev burn the given token id.
     * @param tokenId token id to burn.
     */
    function burn(uint256 tokenId) public checkTokenIdExists(tokenId) {
        require(ownerOf(tokenId) == msg.sender || owner() == msg.sender);
        _burn(tokenId);
    }

    ///////////////////////////////////////////////////////////////////
    //// Minting Tokens
    ///////////////////////////////////////////////////////////////////

    /**
     * @dev check if the sender is not a contract.
     */
    modifier checkSender() {
        require(tx.origin == msg.sender, "minting from contract is not allowed");
        _;
    }

    //////////////////////////////////
    //// Admin Mint
    //////////////////////////////////

    /**
     * @dev mint the given amount to the given address.
     * @param amount amount to mint.
     */
    function adminMint(uint256 amount) external onlyOwner checkMintAmount(amount) {
        _mint(msg.sender, amount);
    }

    /**
     * @dev mint the given amount to the given address.
     * @param to address to mint.
     * @param amount amount to mint.
     */
    function adminMintTo(address to, uint256 amount) external onlyOwner checkMintAmount(amount) {
        _mint(to, amount);
    }

    //////////////////////////////////
    //// Public Mint
    //////////////////////////////////

    /**
     * @dev mint the given amount to the given address.
     * @param amount amount to mint.
     */
    function publicMint(
        uint256 amount
    )
        external
        payable
        checkSender
        whenPublicMintingAvailable
        checkMintAmount(amount)
        checkPay(publicMintPrice, amount)
    {
        _mint(msg.sender, amount);
        emit PublicMinted(msg.sender, _nextTokenId() - amount, amount);
    }

    //////////////////////////////////
    //// Allowlist Mint
    //////////////////////////////////

    /**
     * @dev mint the given amount to the given address.
     * @param amount amount to mint.
     * @param merkleProof merkle proof to check.
     */
    function allowlistMint(
        uint256 amount,
        bytes32[] calldata merkleProof
    )
        external
        payable
        checkSender
        whenAllowlistMintingAvailable
        checkAllowlist(merkleProof)
        checkAllowlistMintLimit(amount)
        checkMintAmount(amount)
        checkPay(allowlistMintPrice, amount)
    {
        _incrementAllowlistMemberMintCount(msg.sender, amount);
        _mint(msg.sender, amount);
        emit AllowlistMinted(msg.sender, _nextTokenId() - amount, amount);
    }

    ///////////////////////////////////////////////////////////////////
    //// Minting Limit
    ///////////////////////////////////////////////////////////////////

    /**
     * @dev maximum number of tokens to mint.
     */
    uint256 public mintLimit;

    /**
     * @dev get maximum number of tokens to mint.
     */
    function setMintLimit(uint256 _mintLimit) external onlyOwner {
        require(_mintLimit >= _nextTokenId(), "mint limit must be greater than the last token ID");
        mintLimit = _mintLimit;
    }

    modifier checkMintAmount(uint256 amount) {
        require(amount > 0, "minting amount must be greater than 0");
        require(_totalMinted() + amount <= mintLimit, "minting exceeds the limit");
        _;
    }

    function publicMintLastTokenId() external view override returns (uint256) {
        return mintLimit;
    }

    function allowlistMintLastTokenId() external view override returns (uint256) {
        return mintLimit;
    }

    //////////////////////////////////
    //// Allowlist
    //////////////////////////////////

    /**
     * @dev The ID of the allowlist sale.
     */
    uint256 public allowlistSaleId;

    /**
     * @dev Increment the allowlist sale ID.
     */
    function incrementAllowlistSaleId() external onlyOwner {
        allowlistSaleId++;
    }

    /**
     * @dev The number of tokens minted in the allowlist minting for each address and sale ID.
     * Solidity does not support iterating over a mapping and clearing all entries.
     * Additionally iterating to erase all entries with another mapping to remember keys is expensive.
     * So we use a mapping of mapping to switch (reset) the mapping.
     */
    mapping(uint256 => mapping(address => uint256)) private _allowlistSaleIdToMemberMintCount;

    /**
     * @dev The number of tokens minted in the allowlist minting for the specified address.
     * @param member The address to check the number of tokens minted in the allowlist minting.
     */
    function allowlistMemberMintCount(address member) public view returns (uint256) {
        return _allowlistSaleIdToMemberMintCount[allowlistSaleId][member];
    }

    /**
     * @dev Count up the number of tokens minted in the allowlist minting for the specified address.
     * @param member The address to count up the number of tokens minted in the allowlist minting.
     * @param amount The number of tokens to mint.
     */
    function _incrementAllowlistMemberMintCount(address member, uint256 amount) private {
        _allowlistSaleIdToMemberMintCount[allowlistSaleId][member] += amount;
    }

    /**
     * @dev maximum number of tokens to mint per allowlisted member.
     */
    uint256 public allowlistedMemberMintLimit;

    /**
     * @dev set maximum number of tokens to mint per allowlisted member.
     * @param amount maximum number of tokens to mint per allowlisted member.
     */
    function setAllowlistedMemberMintLimit(uint256 amount) external onlyOwner {
        allowlistedMemberMintLimit = amount;
    }

    /**
     * @dev check if the given amount is allowed to mint.
     * @param amount amount to check.
     */
    modifier checkAllowlistMintLimit(uint256 amount) {
        require(
            allowlistMemberMintCount(msg.sender) + amount <= allowlistedMemberMintLimit,
            "allowlist minting exceeds the limit"
        );
        _;
    }

    ///////////////////////////////////////////////////////////////////
    //// Pricing
    ///////////////////////////////////////////////////////////////////

    /**
     * @dev check if the paid amount is enough.
     * @param price price to check.
     * @param amount amount to check.
     */
    modifier checkPay(uint256 price, uint256 amount) {
        require(msg.value == price * amount, "invalid amount of eth sent");
        _;
    }

    //////////////////////////////////
    //// Public Mint
    //////////////////////////////////

    /**
     * @notice public price.
     */
    uint256 public publicMintPrice;

    /**
     * @dev set public price.
     * @param price public price.
     */
    function setPublicMintPrice(uint256 price) external onlyOwner {
        publicMintPrice = price;
        emit PublicMintPriceChanged(price);
    }

    //////////////////////////////////
    //// Allowlist Mint
    //////////////////////////////////

    /**
     * @notice allowlist price.
     */
    uint256 public allowlistMintPrice;

    /**
     * @dev set allowlist price.
     * @param price allowlist price.
     */
    function setAllowlistMintPrice(uint256 price) external onlyOwner {
        allowlistMintPrice = price;
        emit AllowlistMintPriceChanged(price);
    }

    ///////////////////////////////////////////////////////////////////
    //// Member Verification
    ///////////////////////////////////////////////////////////////////

    //////////////////////////////////
    //// Allowlist
    //////////////////////////////////

    /**
     * @dev merkle root of the allowlist.
     */
    bytes32 private _allowlistMerkleRoot;

    /**
     * @dev set merkle root of the allowlist.
     * @param merkleRoot merkle root of the allowlist.
     */
    function setAllowlist(bytes32 merkleRoot) external onlyOwner {
        _allowlistMerkleRoot = merkleRoot;
    }

    /**
     * @dev check if the given address is allowlisted.
     * @param merkleProof merkle proof to check.
     */
    function isAllowlisted(bytes32[] calldata merkleProof) public view returns (bool) {
        return merkleProof.verify(_allowlistMerkleRoot, keccak256(abi.encodePacked(msg.sender)));
    }

    modifier checkAllowlist(bytes32[] calldata merkleProof) {
        require(isAllowlisted(merkleProof), "invalid merkle proof");
        _;
    }

    ///////////////////////////////////////////////////////////////////
    //// Minting Period
    ///////////////////////////////////////////////////////////////////

    //////////////////////////////////
    //// Public Mint
    //////////////////////////////////

    /**
     * @notice timestamp to start public minting
     */
    uint256 public publicMintStartTimestamp;

    /**
     * @notice timestamp to end public minting
     */
    uint256 public publicMintEndTimestamp;

    /**
     * @dev set timestamp to start and end public minting
     * @param startTimestamp timestamp to start public minting
     * @param endTimestamp timestamp to end public minting
     */
    function setPublicMintAvailablePeriod(uint256 startTimestamp, uint256 endTimestamp) external onlyOwner {
        require(startTimestamp <= endTimestamp, "invalid period");
        publicMintStartTimestamp = startTimestamp;
        publicMintEndTimestamp = endTimestamp;
        emit PublicMintAvailablePeriodChanged(startTimestamp, endTimestamp);
    }

    /**
     * @dev modifier to check if public minting is available
     */
    modifier whenPublicMintingAvailable() {
        require(
            publicMintStartTimestamp <= block.timestamp && block.timestamp <= publicMintEndTimestamp,
            "public minting: not started or ended"
        );
        _;
    }

    //////////////////////////////////
    //// Allowlist Mint
    //////////////////////////////////

    /**
     * @notice timestamp to start allowlist minting
     */
    uint256 public allowlistMintStartTimestamp;

    /**
     * @notice timestamp to end allowlist minting
     */
    uint256 public allowlistMintEndTimestamp;

    /**
     * @dev set timestamp to start and end allowlist minting
     * @param startTimestamp timestamp to start allowlist minting
     * @param endTimestamp timestamp to end allowlist minting
     */
    function setAllowlistMintAvailablePeriod(uint256 startTimestamp, uint256 endTimestamp) external onlyOwner {
        require(startTimestamp <= endTimestamp, "invalid period");
        allowlistMintStartTimestamp = startTimestamp;
        allowlistMintEndTimestamp = endTimestamp;
        emit AllowlistMintAvailablePeriodChanged(startTimestamp, endTimestamp);
    }

    /**
     * @dev modifier to check if allowlist minting is available
     */
    modifier whenAllowlistMintingAvailable() {
        require(
            allowlistMintStartTimestamp <= block.timestamp && block.timestamp <= allowlistMintEndTimestamp,
            "allowlist minting: not started or ended"
        );
        _;
    }

    ///////////////////////////////////////////////////////////////////
    //// Withdraw
    ///////////////////////////////////////////////////////////////////

    /**
     * @dev withdrawal receiver.
     */
    address private _withdrawalReceiver;

    /**
     * @dev set withdrawal receiver.
     * @param receiver withdrawal receiver.
     */
    function setWithdrawalReceiver(address receiver) external onlyOwner {
        _withdrawalReceiver = receiver;
    }

    /**
     * @dev Withdraw the balance.
     */
    function withdraw() external onlyOwner {
        uint256 amount = address(this).balance;
        (bool success, ) = payable(_withdrawalReceiver).call{value: amount}(new bytes(0));
        if (!success) revert("withdrawal failed");
    }

    ///////////////////////////////////////////////////////////////////
    //// Utilities
    ///////////////////////////////////////////////////////////////////

    /**
     * @dev check if the given token id exists.
     */
    modifier checkTokenIdExists(uint256 tokenId) {
        require(_exists(tokenId), "tokenId not exist");
        _;
    }

    /**
     * @dev RFC 8259 §7 JSON string escaping. Replaces `"` with `\"`, `\` with
     * `\\`, and any control byte (0x00–0x1F) with the six-character
     * `\u00XX` sequence. All other bytes (including UTF-8 high-bit bytes)
     * pass through. Allocates worst-case 6× the input length.
     *
     * Defensive against Dictionary contents — `Dictionary.addWords` accepts
     * arbitrary bytes (ADR-0002 §6 "dumb data store") and `setDictionary` is
     * repointable, so the contract cannot assume off-chain sanitization at
     * read time. Escaping here guarantees the JSON envelope returned by
     * `tokenURI` is always well-formed regardless of Dictionary contents.
     */
    function _jsonEscape(bytes memory data) private pure returns (string memory) {
        bytes16 HEX = "0123456789abcdef";
        bytes memory out = new bytes(data.length * 6);
        uint256 j;
        for (uint256 i = 0; i < data.length; i++) {
            bytes1 b = data[i];
            if (b == 0x22) {
                out[j++] = "\\";
                out[j++] = '"';
            } else if (b == 0x5C) {
                out[j++] = "\\";
                out[j++] = "\\";
            } else if (uint8(b) < 0x20) {
                out[j++] = "\\";
                out[j++] = "u";
                out[j++] = "0";
                out[j++] = "0";
                out[j++] = HEX[uint8(b) >> 4];
                out[j++] = HEX[uint8(b) & 0x0F];
            } else {
                out[j++] = b;
            }
        }
        assembly {
            mstore(out, j)
        }
        return string(out);
    }

    /**
     * @dev RFC 3986 percent-encoding. Unreserved characters (A-Z a-z 0-9 - . _ ~)
     * pass through; every other byte expands to %XX with uppercase hex.
     * tokenURI is a view function so the gas cost of this loop is paid by no one
     * on-chain — read-only callers absorb it server-side.
     */
    function _percentEncode(bytes memory data) private pure returns (string memory) {
        bytes16 HEX = "0123456789ABCDEF";
        bytes memory out = new bytes(data.length * 3);
        uint256 j;
        for (uint256 i = 0; i < data.length; i++) {
            bytes1 b = data[i];
            if (
                (b >= 0x30 && b <= 0x39) ||
                (b >= 0x41 && b <= 0x5A) ||
                (b >= 0x61 && b <= 0x7A) ||
                b == 0x2D ||
                b == 0x2E ||
                b == 0x5F ||
                b == 0x7E
            ) {
                out[j++] = b;
                continue;
            }
            out[j++] = "%";
            out[j++] = HEX[uint8(b) >> 4];
            out[j++] = HEX[uint8(b) & 0x0F];
        }
        // Shrink the output to the actually-written length.
        assembly {
            mstore(out, j)
        }
        return string(out);
    }

    //////////////////////////////////
    //// Token URI (Dream — Dictionary-derived mojiemoji URL)
    ////
    //// Storage layout note: this contract is upgradeable (UUPS proxy). New state
    //// variables MUST be appended at the end of the existing layout to preserve
    //// slot assignments of all previously declared state. `_stampText` was the
    //// original ADR-0001 entry-point storage; it is retained as-is for layout
    //// compatibility but is no longer read or written. All entries below it are
    //// the ADR-0002 Dictionary-derivation additions. Keep any future fields
    //// appended at the end of this section.
    //////////////////////////////////

    /// @dev DEPRECATED (ADR-0001). Retained for storage layout compatibility only.
    ///      Never read or written by the current implementation.
    mapping(uint256 => bytes32) private _stampText;

    /// @dev External word source. Settable post-deploy via `setDictionary`.
    IDictionary public dictionary;

    /// @dev Snapshot of `dictionary.wordCount()` taken at the batch-start tokenId
    ///      of each mint batch. Locks the derivation range so that future
    ///      `addWords` calls do not change existing tokens' URLs.
    mapping(uint256 => uint256) private _wordSnapshotAtBatchStart;

    /**
     * @dev set the Dictionary contract address. Owner-only; can be re-pointed
     * to a new Dictionary at any time. The owner is responsible for ensuring
     * the new Dictionary's indices stay compatible with already-snapshotted
     * ranges of existing tokens (aliasing — see ADR-0002).
     */
    function setDictionary(address dictionaryAddress) external onlyOwner {
        dictionary = IDictionary(dictionaryAddress);
    }

    /**
     * @dev ERC721Psi hook. We only act on mint (`from == address(0)`): write
     * the wordCount snapshot once per batch, at the batch-start tokenId.
     * `addressFrom`, `addressTo`, `quantity` are unused.
     */
    function _afterTokenTransfers(address from, address to, uint256 startTokenId, uint256 quantity) internal override {
        if (from == address(0)) {
            require(address(dictionary) != address(0), "dictionary not set");
            uint256 range = dictionary.wordCount();
            require(range > 0, "dictionary is empty");
            _wordSnapshotAtBatchStart[startTokenId] = range;
        }
        super._afterTokenTransfers(from, to, startTokenId, quantity);
    }

    /**
     * @dev token URI — Dream spec (ADR-0001 + ADR-0002 + ADR-0004).
     * Dictionary-derived word selection is unchanged; the chosen mojiemoji URL
     * is now wrapped in an OpenSea-standard JSON envelope and returned as
     * `data:application/json;base64,...`. The image URL inside the JSON is
     * still the stateless mojiemoji.jozo.beer service that renders the word
     * as an animated picture — Dream "URL = image" is preserved.
     *
     * Robust against arbitrary Dictionary contents: word bytes are
     * JSON-escaped via `_jsonEscape` before embedding in the `value` field,
     * so the envelope stays well-formed even if a future Dictionary contains
     * `"`, `\`, or control characters. The image URL is percent-encoded so
     * the same bytes are safe in the URL context.
     */
    function tokenURI(
        uint256 tokenId
    ) public view virtual override checkTokenIdExists(tokenId) returns (string memory) {
        uint256 batchStart = _getBatchHead(tokenId);
        uint256 range = _wordSnapshotAtBatchStart[batchStart];
        uint256 idx = uint256(keccak256(abi.encode(tokenId))) % range;
        bytes memory text = dictionary.wordAt(idx);
        string memory imageUrl = string(
            abi.encodePacked("https://mojiemoji.jozo.beer/?text=", _percentEncode(text))
        );
        bytes memory json = abi.encodePacked(
            '{"name":"Onchain Mojiemoji #',
            tokenId.toString(),
            '","description":"',
            _DESCRIPTION_TOKEN,
            '","image":"',
            imageUrl,
            '","attributes":[{"trait_type":"word","value":"',
            _jsonEscape(text),
            '"}]}'
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64Upgradeable.encode(json)));
    }
}
