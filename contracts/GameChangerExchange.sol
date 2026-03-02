// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/**
 * @title GameChangerExchange
 * @notice GCH token marketplace with on-chain NFT ownership.
 *         Purchasing any listing (country unlock, DLC, skin, bundle)
 *         mints an ERC-1155 token to the buyer's wallet.  Token ID == listing ID,
 *         so any wallet or explorer can verify ownership with balanceOf(player, listingId).
 *
 *         Listings are created dynamically by the owner — no redeployment needed to
 *         add new countries, seasons, or content packs.
 */
contract GameChangerExchange is ERC1155, Ownable, ReentrancyGuard, Pausable {

    // ─── GCH Token Ledger ────────────────────────────────────────────────────

    address public marketplaceWallet;
    /// @notice Address authorised to call mintItemTo (the platform gas wallet).
    address public minter;

    /// @notice How many GCH tokens 1 full AVAX (1e18 wei) buys. Owner-updatable.
    uint256 public gchPerAvax = 1000;

    mapping(address => uint256) public gchBalance;
    mapping(address => uint256) public modderEarnings;
    uint256 public totalGCHMinted;

    // ─── Listing Registry ────────────────────────────────────────────────────

    enum Category { SKIN, DLC, BUNDLE, COSMETIC, COUNTRY, OTHER }

    struct Listing {
        uint256  id;
        string   name;         // e.g. "United Kingdom Unlocked"
        string   sku;          // short key, e.g. "UK_UNLOCKED"
        Category category;
        uint256  priceGCH;     // cost in GCH
        uint256  supply;       // 0 = unlimited
        uint256  sold;         // NFTs minted so far
        address  modder;       // address(0) = platform-only
        uint16   modderBps;    // modder share in basis points (max 9500)
        bool     active;
        uint64   expiresAt;    // 0 = never expires
    }

    uint256 public listingCount;
    mapping(uint256 => Listing) public listings;

    // Redeem codes (for game-server integration alongside NFT ownership)
    mapping(bytes32 => uint256) public codeToListing;
    mapping(bytes32 => bool)    public codeUsed;

    // ─── Poll Registry ───────────────────────────────────────────────────────

    struct Option {
        string  label;
        uint256 votes;
    }

    struct Poll {
        uint256  id;
        string   question;
        uint256  costGCH;
        bool     active;
        uint64   endsAt;
        uint256  optionCount;
        mapping(uint256 => Option)  options;
        mapping(address => bool)    hasVoted;
    }

    uint256 public pollCount;
    mapping(uint256 => Poll) public polls;

    // ─── Events ──────────────────────────────────────────────────────────────

    event GCHPurchased(address indexed buyer, uint256 gchAmount, uint256 avaxSpent);
    event GchRateUpdated(uint256 oldRate, uint256 newRate);

    event ListingCreated(uint256 indexed id, string name, string sku, uint256 priceGCH, Category category);
    event ListingUpdated(uint256 indexed id);
    event ListingDeactivated(uint256 indexed id);

    /// @dev Emitted on every NFT mint purchase. redeemCode is a bonus for game servers.
    event ItemPurchased(address indexed buyer, uint256 indexed listingId, bytes32 redeemCode);
    event CodeRedeemed(address indexed user, bytes32 indexed code, uint256 listingId);

    event PollCreated(uint256 indexed pollId, string question, uint256 optionCount);
    event PollClosed(uint256 indexed pollId);
    event VoteCast(address indexed voter, uint256 indexed pollId, uint256 optionIndex);

    event ModderCredited(address indexed modder, uint256 gchAmount, string reason);
    event ModderSharePaid(address indexed modder, uint256 indexed listingId, uint256 gchAmount);
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _marketplaceWallet)
        ERC1155("https://gamechanger-market.pages.dev/api/metadata/{id}.json")
        Ownable(msg.sender)
    {
        require(_marketplaceWallet != address(0), "Invalid wallet");
        marketplaceWallet = _marketplaceWallet;
    }

    // =========================================================================
    // GCH TOKEN PURCHASE
    // =========================================================================

    /**
     * @notice Buy GCH tokens with AVAX.
     * @param gchAmount Number of GCH tokens to buy.
     *        Required AVAX = gchAmount * 1e18 / gchPerAvax
     */
    function buyGCHWithAVAX(uint256 gchAmount) external payable nonReentrant whenNotPaused {
        require(gchAmount > 0, "Amount must be > 0");
        uint256 required = (gchAmount * 1e18) / gchPerAvax;
        require(msg.value >= required, "Insufficient AVAX");

        uint256 excess = msg.value - required;

        gchBalance[msg.sender] += gchAmount;
        totalGCHMinted         += gchAmount;

        (bool sent, ) = marketplaceWallet.call{value: required}("");
        require(sent, "AVAX transfer failed");

        if (excess > 0) {
            (bool refunded, ) = msg.sender.call{value: excess}("");
            require(refunded, "Refund failed");
        }

        emit GCHPurchased(msg.sender, gchAmount, required);
    }

    // =========================================================================
    // LISTING MANAGEMENT  (owner only)
    // =========================================================================

    /**
     * @notice Register a new purchasable item. Purchasing it will mint an ERC-1155
     *         NFT (token ID == listing ID) to the buyer's wallet.
     * @param name       Display name, e.g. "United Kingdom Unlocked".
     * @param sku        Short uppercase key, e.g. "UK_UNLOCKED".
     * @param category   Category enum value (COUNTRY = 4 for nation unlocks).
     * @param priceGCH   Cost in GCH.
     * @param supply     Max NFTs that can be minted (0 = unlimited).
     * @param modder     Modder revenue address (address(0) = none).
     * @param modderBps  Modder share in basis points (max 9500).
     * @param expiresAt  Unix timestamp cutoff (0 = never).
     */
    function createListing(
        string  calldata name,
        string  calldata sku,
        Category         category,
        uint256          priceGCH,
        uint256          supply,
        address          modder,
        uint16           modderBps,
        uint64           expiresAt
    ) external onlyOwner returns (uint256 id) {
        require(bytes(name).length > 0, "Name required");
        require(bytes(sku).length  > 0, "SKU required");
        require(priceGCH > 0,           "Price must be > 0");
        require(modderBps <= 9500,       "modderBps > 95%");

        id = ++listingCount;
        listings[id] = Listing({
            id:        id,
            name:      name,
            sku:       sku,
            category:  category,
            priceGCH:  priceGCH,
            supply:    supply,
            sold:      0,
            modder:    modder,
            modderBps: modderBps,
            active:    true,
            expiresAt: expiresAt
        });

        emit ListingCreated(id, name, sku, priceGCH, category);
    }

    /**
     * @notice Update mutable fields of an existing listing.
     *         Name, SKU, and category are immutable after creation.
     */
    function updateListing(
        uint256 id,
        uint256 priceGCH,
        uint256 supply,
        address modder,
        uint16  modderBps,
        uint64  expiresAt,
        bool    active
    ) external onlyOwner {
        require(id > 0 && id <= listingCount, "Invalid listing");
        require(modderBps <= 9500, "modderBps > 95%");
        Listing storage l = listings[id];
        l.priceGCH  = priceGCH;
        l.supply    = supply;
        l.modder    = modder;
        l.modderBps = modderBps;
        l.expiresAt = expiresAt;
        l.active    = active;
        emit ListingUpdated(id);
    }

    function deactivateListing(uint256 id) external onlyOwner {
        require(id > 0 && id <= listingCount, "Invalid listing");
        listings[id].active = false;
        emit ListingDeactivated(id);
    }

    // =========================================================================
    // ITEM PURCHASE — mints ERC-1155 NFT + emits redeem code
    // =========================================================================

    /**
     * @notice Purchase any active listing by ID.
     *         Deducts GCH, mints one ERC-1155 token (listingId) to the buyer,
     *         splits revenue to modder, and emits a redeem code for game servers.
     * @param listingId  The listing to purchase.
     * @return redeemCode  Unique bytes32 redeemable in-game.
     */
    function purchaseItem(uint256 listingId)
        external
        nonReentrant
        whenNotPaused
        returns (bytes32 redeemCode)
    {
        Listing storage l = listings[listingId];
        require(l.active,                                             "Listing inactive");
        require(l.expiresAt == 0 || block.timestamp < l.expiresAt,   "Listing expired");
        require(l.supply == 0 || l.sold < l.supply,                   "Sold out");
        require(gchBalance[msg.sender] >= l.priceGCH,                 "Insufficient GCH");

        // Deduct GCH
        gchBalance[msg.sender] -= l.priceGCH;
        l.sold += 1;

        // Modder revenue split
        if (l.modder != address(0) && l.modderBps > 0) {
            uint256 modderShare = (l.priceGCH * l.modderBps) / 10000;
            modderEarnings[l.modder] += modderShare;
            emit ModderSharePaid(l.modder, listingId, modderShare);
        }

        // Mint ERC-1155 NFT — token ID == listingId, amount == 1
        _mint(msg.sender, listingId, 1, "");

        // Emit redeem code for game-server integration
        redeemCode = keccak256(
            abi.encodePacked(msg.sender, listingId, l.sku, block.timestamp, block.prevrandao)
        );
        codeToListing[redeemCode] = listingId;

        emit ItemPurchased(msg.sender, listingId, redeemCode);
    }

    /**
     * @notice Mark a redeem code as used (called by game server or owner).
     */
    function redeemCode(bytes32 code) external nonReentrant {
        require(codeToListing[code] != 0, "Invalid code");
        require(!codeUsed[code],          "Already redeemed");
        codeUsed[code] = true;
        emit CodeRedeemed(msg.sender, code, codeToListing[code]);
    }

    /**
     * @notice Mint an NFT directly to a recipient for an off-chain USD purchase.
     *         The GCH payment was already handled in KV; this just mints the NFT
     *         and records the redeem code.  Gas is paid by the platform gas wallet.
     *         Only the contract owner or the authorised minter address may call this.
     * @param recipient  Wallet that receives the NFT.
     * @param listingId  Listing to mint.
     */
    function mintItemTo(address recipient, uint256 listingId)
        external
        nonReentrant
        whenNotPaused
        returns (bytes32 redeemCode_)
    {
        require(
            msg.sender == owner() || (minter != address(0) && msg.sender == minter),
            "Not authorised"
        );
        require(recipient != address(0), "Invalid recipient");

        Listing storage l = listings[listingId];
        require(l.active,                                           "Listing inactive");
        require(l.expiresAt == 0 || block.timestamp < l.expiresAt, "Listing expired");
        require(l.supply == 0 || l.sold < l.supply,                "Sold out");

        l.sold += 1;
        _mint(recipient, listingId, 1, "");

        redeemCode_ = keccak256(
            abi.encodePacked(recipient, listingId, l.sku, block.timestamp, block.prevrandao)
        );
        codeToListing[redeemCode_] = listingId;

        emit ItemPurchased(recipient, listingId, redeemCode_);
    }

    // =========================================================================
    // POLL MANAGEMENT  (owner only)
    // =========================================================================

    /**
     * @notice Create a new governance poll with an arbitrary list of options.
     */
    function createPoll(
        string   calldata   question,
        string[] calldata   options,
        uint256             costGCH,
        uint64              endsAt
    ) external onlyOwner returns (uint256 pollId) {
        require(bytes(question).length > 0, "Question required");
        require(options.length >= 2,        "Need >= 2 options");

        pollId = ++pollCount;
        Poll storage p = polls[pollId];
        p.id       = pollId;
        p.question = question;
        p.costGCH  = costGCH;
        p.active   = true;
        p.endsAt   = endsAt;

        for (uint256 i = 0; i < options.length; i++) {
            p.options[i] = Option({ label: options[i], votes: 0 });
        }
        p.optionCount = options.length;

        emit PollCreated(pollId, question, options.length);
    }

    function closePoll(uint256 pollId) external onlyOwner {
        require(pollId > 0 && pollId <= pollCount, "Invalid poll");
        polls[pollId].active = false;
        emit PollClosed(pollId);
    }

    // =========================================================================
    // VOTING
    // =========================================================================

    function castVote(uint256 pollId, uint256 optionIndex)
        external
        nonReentrant
        whenNotPaused
    {
        Poll storage p = polls[pollId];
        require(p.active,                                     "Poll inactive");
        require(p.endsAt == 0 || block.timestamp < p.endsAt, "Poll ended");
        require(optionIndex < p.optionCount,                   "Invalid option");
        require(!p.hasVoted[msg.sender],                       "Already voted");

        if (p.costGCH > 0) {
            require(gchBalance[msg.sender] >= p.costGCH, "Insufficient GCH");
            gchBalance[msg.sender] -= p.costGCH;
        }

        p.options[optionIndex].votes += 1;
        p.hasVoted[msg.sender] = true;

        emit VoteCast(msg.sender, pollId, optionIndex);
    }

    // =========================================================================
    // MODDER MANAGEMENT
    // =========================================================================

    function creditModder(address modder, uint256 gchAmount, string calldata reason)
        external
        onlyOwner
    {
        require(modder != address(0), "Invalid modder");
        modderEarnings[modder] += gchAmount;
        gchBalance[modder]     += gchAmount;
        totalGCHMinted         += gchAmount;
        emit ModderCredited(modder, gchAmount, reason);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    function getBalance(address user) external view returns (uint256) {
        return gchBalance[user];
    }

    /**
     * @notice Check if a player owns a specific listing (country/content unlock).
     *         Uses ERC-1155 balanceOf: true if the player holds >= 1 NFT of that listingId.
     */
    function ownsListing(address player, uint256 listingId) external view returns (bool) {
        return balanceOf(player, listingId) > 0;
    }

    function getListing(uint256 id) external view returns (
        string memory name,
        string memory sku,
        Category      category,
        uint256       priceGCH,
        uint256       supply,
        uint256       sold,
        address       modder,
        uint16        modderBps,
        bool          active,
        uint64        expiresAt
    ) {
        Listing storage l = listings[id];
        return (l.name, l.sku, l.category, l.priceGCH, l.supply,
                l.sold, l.modder, l.modderBps, l.active, l.expiresAt);
    }

    /**
     * @notice Returns all active listing IDs in one call.
     */
    function getActiveListings() external view returns (uint256[] memory ids) {
        uint256 total = listingCount;
        uint256[] memory temp = new uint256[](total);
        uint256 count;
        for (uint256 i = 1; i <= total; i++) {
            Listing storage l = listings[i];
            if (l.active && (l.expiresAt == 0 || block.timestamp < l.expiresAt)
                         && (l.supply == 0 || l.sold < l.supply)) {
                temp[count++] = i;
            }
        }
        ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) ids[i] = temp[i];
    }

    function getPollOption(uint256 pollId, uint256 optionIndex)
        external view returns (string memory label, uint256 votes)
    {
        Option storage o = polls[pollId].options[optionIndex];
        return (o.label, o.votes);
    }

    function getPollResults(uint256 pollId)
        external view
        returns (string[] memory labels, uint256[] memory voteCounts)
    {
        Poll storage p = polls[pollId];
        uint256 n = p.optionCount;
        labels     = new string[](n);
        voteCounts = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            labels[i]     = p.options[i].label;
            voteCounts[i] = p.options[i].votes;
        }
    }

    function getPollMeta(uint256 pollId)
        external view
        returns (string memory question, uint256 costGCH, bool active,
                 uint64 endsAt, uint256 optionCount)
    {
        Poll storage p = polls[pollId];
        return (p.question, p.costGCH, p.active, p.endsAt, p.optionCount);
    }

    function hasVoted(uint256 pollId, address user) external view returns (bool) {
        return polls[pollId].hasVoted[user];
    }

    function isCodeValid(bytes32 code) external view returns (bool valid, uint256 listingId) {
        listingId = codeToListing[code];
        valid     = listingId != 0 && !codeUsed[code];
    }

    // =========================================================================
    // ADMIN
    // =========================================================================

    function setGchPerAvax(uint256 newRate) external onlyOwner {
        require(newRate > 0, "Rate must be > 0");
        emit GchRateUpdated(gchPerAvax, newRate);
        gchPerAvax = newRate;
    }

    function setMarketplaceWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "Invalid wallet");
        marketplaceWallet = _wallet;
    }

    /// @notice Authorise a gas-wallet address to call mintItemTo on behalf of the platform.
    function setMinter(address _minter) external onlyOwner {
        emit MinterUpdated(minter, _minter);
        minter = _minter;
    }

    /// @notice Update the ERC-1155 metadata base URI (e.g. point to new IPFS CID).
    function setBaseURI(string calldata newUri) external onlyOwner {
        _setURI(newUri);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
