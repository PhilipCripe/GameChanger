// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title GameChangerExchange
 * @notice Scalable marketplace on Avalanche Fuji.
 *         - Dynamic item listings: add any skin/DLC/bundle without redeploying.
 *         - Dynamic polls: create any vote with N options without redeploying.
 *         - Per-listing revenue split between platform and credited modder.
 *         - GCH token ledger: 1 AVAX = GCH_PER_AVAX (updatable by owner).
 */
contract GameChangerExchange is Ownable, ReentrancyGuard, Pausable {

    // ─── GCH Exchange ────────────────────────────────────────────────────────

    address public marketplaceWallet;

    /// @notice How many GCH tokens 1 full AVAX (1e18 wei) buys. Owner-updatable.
    uint256 public gchPerAvax = 1000;

    mapping(address => uint256) public gchBalance;
    mapping(address => uint256) public modderEarnings;
    uint256 public totalGCHMinted;

    // ─── Listing Registry ────────────────────────────────────────────────────

    enum Category { SKIN, DLC, BUNDLE, COSMETIC, OTHER }

    struct Listing {
        uint256  id;
        string   name;         // e.g. "Bayraktar TB2"
        string   sku;          // short identifier used in redeem codes, e.g. "BAYRAKTAR"
        Category category;
        uint256  priceGCH;     // cost in GCH tokens
        uint256  supply;       // 0 = unlimited
        uint256  sold;         // units sold so far
        address  modder;       // address(0) = platform-only revenue
        uint16   modderBps;    // modder revenue share in basis points (e.g. 3000 = 30%)
        bool     active;
        uint64   expiresAt;    // 0 = never expires (unix timestamp)
    }

    uint256 public listingCount;
    mapping(uint256 => Listing) public listings;

    // Redeem codes
    mapping(bytes32 => uint256) public codeToListing; // code => listingId
    mapping(bytes32 => bool)    public codeUsed;

    // ─── Poll Registry ───────────────────────────────────────────────────────

    struct Option {
        string  label;
        uint256 votes;
    }

    struct Poll {
        uint256  id;
        string   question;
        uint256  costGCH;      // GCH required to vote
        bool     active;
        uint64   endsAt;       // 0 = no deadline
        uint256  optionCount;
        mapping(uint256 => Option)  options;  // optionIndex => Option
        mapping(address => bool)    hasVoted; // one vote per address per poll
    }

    uint256 public pollCount;
    mapping(uint256 => Poll) public polls;

    // ─── Events ──────────────────────────────────────────────────────────────

    event GCHPurchased(address indexed buyer, uint256 gchAmount, uint256 avaxSpent);
    event GchRateUpdated(uint256 oldRate, uint256 newRate);

    event ListingCreated(uint256 indexed id, string name, string sku, uint256 priceGCH, Category category);
    event ListingUpdated(uint256 indexed id);
    event ListingDeactivated(uint256 indexed id);
    event ItemPurchased(address indexed buyer, uint256 indexed listingId, bytes32 redeemCode);
    event CodeRedeemed(address indexed user, bytes32 indexed code, uint256 listingId);

    event PollCreated(uint256 indexed pollId, string question, uint256 optionCount);
    event PollClosed(uint256 indexed pollId);
    event VoteCast(address indexed voter, uint256 indexed pollId, uint256 optionIndex);

    event ModderCredited(address indexed modder, uint256 gchAmount, string reason);
    event ModderSharePaid(address indexed modder, uint256 indexed listingId, uint256 gchAmount);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _marketplaceWallet) Ownable(msg.sender) {
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

        // Refund any overpayment
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
     * @notice Register a new purchasable item.
     * @param name       Display name.
     * @param sku        Short uppercase key embedded in the redeem code.
     * @param category   Category enum value.
     * @param priceGCH   Cost in GCH.
     * @param supply     Max units (0 = unlimited).
     * @param modder     Address that receives modder revenue share (address(0) = none).
     * @param modderBps  Modder share in basis points (max 9000 = 90%).
     * @param expiresAt  Unix timestamp after which listing is inactive (0 = never).
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
        require(modderBps <= 9000,       "modderBps > 90%");

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
     *         Cannot change name/sku/category after creation.
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
        require(modderBps <= 9000, "modderBps > 90%");
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
    // ITEM PURCHASE  (generic – works for every current and future listing)
    // =========================================================================

    /**
     * @notice Purchase any active listing by ID.
     *         Deducts GCH, mints an on-chain redeem code, and splits
     *         revenue between platform and modder (if configured).
     * @param listingId  The listing to purchase.
     * @return redeemCode  A unique bytes32 code the buyer can present in-game.
     */
    function purchaseItem(uint256 listingId)
        external
        nonReentrant
        whenNotPaused
        returns (bytes32 redeemCode)
    {
        Listing storage l = listings[listingId];
        require(l.active,                                  "Listing inactive");
        require(l.expiresAt == 0 || block.timestamp < l.expiresAt, "Listing expired");
        require(l.supply == 0 || l.sold < l.supply,        "Sold out");
        require(gchBalance[msg.sender] >= l.priceGCH,      "Insufficient GCH");

        // Deduct GCH
        gchBalance[msg.sender] -= l.priceGCH;
        l.sold += 1;

        // Modder revenue split
        if (l.modder != address(0) && l.modderBps > 0) {
            uint256 modderShare = (l.priceGCH * l.modderBps) / 10000;
            modderEarnings[l.modder] += modderShare;
            // Note: modder earns from the burned GCH pool; the platform
            //       backend credits actual USD payouts via WDK.
            emit ModderSharePaid(l.modder, listingId, modderShare);
        }

        // Mint unique redeem code
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

    // =========================================================================
    // POLL MANAGEMENT  (owner only)
    // =========================================================================

    /**
     * @notice Create a new poll with an arbitrary list of options.
     * @param question  The vote question.
     * @param options   Array of option labels (min 2).
     * @param costGCH   GCH cost per vote (0 = free).
     * @param endsAt    Unix timestamp deadline (0 = no deadline).
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
    // VOTING  (generic – works for every current and future poll)
    // =========================================================================

    /**
     * @notice Cast a vote on any active poll.
     * @param pollId       The poll to vote on.
     * @param optionIndex  Zero-based index of the chosen option.
     */
    function castVote(uint256 pollId, uint256 optionIndex)
        external
        nonReentrant
        whenNotPaused
    {
        Poll storage p = polls[pollId];
        require(p.active,                                    "Poll inactive");
        require(p.endsAt == 0 || block.timestamp < p.endsAt, "Poll ended");
        require(optionIndex < p.optionCount,                  "Invalid option");
        require(!p.hasVoted[msg.sender],                      "Already voted");

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

    /**
     * @notice Owner credits a modder's GCH balance (e.g. for off-chain contributions).
     */
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
     *         Clients iterate this to build the marketplace UI.
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

    /**
     * @notice Returns all option labels and vote counts for a poll.
     */
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

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
