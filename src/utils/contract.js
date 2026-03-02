import { ethers } from "ethers";

export const FUJI_CHAIN_ID = 43113;
export const FUJI_RPC      = "https://api.avax-test.network/ext/bc/C/rpc";

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

// ─── Category enum (mirrors Solidity) ────────────────────────────────────────
export const Category = {
  SKIN:     0,
  DLC:      1,
  BUNDLE:   2,
  COSMETIC: 3,
  OTHER:    4,
};

export const CATEGORY_LABELS = ["Skin", "DLC", "Bundle", "Cosmetic", "Country Unlock", "Other"];

// ─── ABI ─────────────────────────────────────────────────────────────────────
export const CONTRACT_ABI = [
  // ── GCH purchase ──
  "function buyGCHWithAVAX(uint256 gchAmount) payable",
  "function gchPerAvax() view returns (uint256)",
  "function totalGCHMinted() view returns (uint256)",

  // ── Balances ──
  "function gchBalance(address) view returns (uint256)",
  "function modderEarnings(address) view returns (uint256)",
  "function getBalance(address) view returns (uint256)",

  // ── Listing registry ──
  "function listingCount() view returns (uint256)",
  "function createListing(string name, string sku, uint8 category, uint256 priceGCH, uint256 supply, address modder, uint16 modderBps, uint64 expiresAt) returns (uint256)",
  "function updateListing(uint256 id, uint256 priceGCH, uint256 supply, address modder, uint16 modderBps, uint64 expiresAt, bool active)",
  "function deactivateListing(uint256 id)",
  "function getListing(uint256 id) view returns (string name, string sku, uint8 category, uint256 priceGCH, uint256 supply, uint256 sold, address modder, uint16 modderBps, bool active, uint64 expiresAt)",
  "function getActiveListings() view returns (uint256[] ids)",

  // ── Item purchase ──
  "function purchaseItem(uint256 listingId) returns (bytes32 redeemCode)",
  "function redeemCode(bytes32 code)",
  "function isCodeValid(bytes32 code) view returns (bool valid, uint256 listingId)",

  // ── Poll registry ──
  "function pollCount() view returns (uint256)",
  "function createPoll(string question, string[] options, uint256 costGCH, uint64 endsAt) returns (uint256)",
  "function closePoll(uint256 pollId)",
  "function getPollMeta(uint256 pollId) view returns (string question, uint256 costGCH, bool active, uint64 endsAt, uint256 optionCount)",
  "function getPollResults(uint256 pollId) view returns (string[] labels, uint256[] voteCounts)",
  "function getPollOption(uint256 pollId, uint256 optionIndex) view returns (string label, uint256 votes)",
  "function hasVoted(uint256 pollId, address user) view returns (bool)",

  // ── Voting ──
  "function castVote(uint256 pollId, uint256 optionIndex)",

  // ── Modder ──
  "function creditModder(address modder, uint256 gchAmount, string reason)",

  // ── Admin ──
  "function owner() view returns (address)",
  "function minter() view returns (address)",
  "function setMinter(address _minter)",
  "function setGchPerAvax(uint256 newRate)",
  "function setMarketplaceWallet(address _wallet)",
  "function pause()",
  "function unpause()",

  // ── Events ──
  "event GCHPurchased(address indexed buyer, uint256 gchAmount, uint256 avaxSpent)",
  "event GchRateUpdated(uint256 oldRate, uint256 newRate)",
  "event ListingCreated(uint256 indexed id, string name, string sku, uint256 priceGCH, uint8 category)",
  "event ItemPurchased(address indexed buyer, uint256 indexed listingId, bytes32 redeemCode)",
  "event CodeRedeemed(address indexed user, bytes32 indexed code, uint256 listingId)",
  "event PollCreated(uint256 indexed pollId, string question, uint256 optionCount)",
  "event VoteCast(address indexed voter, uint256 indexed pollId, uint256 optionIndex)",
  "event ModderCredited(address indexed modder, uint256 gchAmount, string reason)",
  "event ModderSharePaid(address indexed modder, uint256 indexed listingId, uint256 gchAmount)",
];

// ─── Network helpers ──────────────────────────────────────────────────────────
export const FUJI_NETWORK = {
  chainId:          "0xa869",
  chainName:        "Avalanche Fuji Testnet",
  nativeCurrency:   { name: "AVAX", symbol: "AVAX", decimals: 18 },
  rpcUrls:          ["https://api.avax-test.network/ext/bc/C/rpc"],
  blockExplorerUrls:["https://testnet.snowtrace.io/"],
};

export async function switchToFuji() {
  if (!window.ethereum) throw new Error("MetaMask not found");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xa869" }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [FUJI_NETWORK],
      });
    } else throw err;
  }
}

export function getProvider() {
  if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
  return new ethers.JsonRpcProvider(FUJI_RPC);
}

export async function getSigner() {
  return getProvider().getSigner();
}

export function getContract(signerOrProvider) {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
}

// ─── GCH ↔ AVAX math ─────────────────────────────────────────────────────────
/** Returns wei required to buy `gchAmount` tokens at `rate` GCH/AVAX */
export function gchToWei(gchAmount, rate = 1000n) {
  const r = typeof rate === "bigint" ? rate : BigInt(rate);
  return (BigInt(gchAmount) * 10n ** 18n) / r;
}

export function formatGCH(val) {
  return Number(val).toLocaleString() + " GCH";
}

// ─── Load all active listings from contract ───────────────────────────────────
export async function fetchListings(provider) {
  const contract = getContract(provider);
  const ids = await contract.getActiveListings();
  return Promise.all(
    ids.map(async (id) => {
      const l = await contract.getListing(id);
      return {
        id:        Number(id),
        name:      l.name,
        sku:       l.sku,
        category:  Number(l.category),
        priceGCH:  Number(l.priceGCH),
        supply:    Number(l.supply),
        sold:      Number(l.sold),
        modder:    l.modder,
        modderBps: Number(l.modderBps),
        active:    l.active,
        expiresAt: Number(l.expiresAt),
        // UI helpers
        image:     `/skins/${l.sku.toLowerCase()}.svg`,
        rarity:    Number(l.priceGCH) >= 500 ? "Legendary"
                 : Number(l.priceGCH) >= 200 ? "Rare" : "Common",
        rarityColor: Number(l.priceGCH) >= 500 ? "text-yellow-400"
                   : Number(l.priceGCH) >= 200 ? "text-blue-400" : "text-gray-400",
      };
    })
  );
}

// ─── Load ALL listings (admin) ───────────────────────────────────────────────
export async function fetchAllListings(provider) {
  const contract = getContract(provider);
  const count    = Number(await contract.listingCount());
  const results  = [];
  for (let id = 1; id <= count; id++) {
    const l = await contract.getListing(id);
    results.push({
      id,
      name:      l.name,
      sku:       l.sku,
      category:  Number(l.category),
      priceGCH:  Number(l.priceGCH),
      supply:    Number(l.supply),
      sold:      Number(l.sold),
      modder:    l.modder,
      modderBps: Number(l.modderBps),
      active:    l.active,
      expiresAt: Number(l.expiresAt),
    });
  }
  return results;
}

// ─── Load ALL polls (admin) ───────────────────────────────────────────────────
export async function fetchAllPolls(provider) {
  const contract = getContract(provider);
  const count    = Number(await contract.pollCount());
  const polls    = [];
  for (let id = 1; id <= count; id++) {
    const meta    = await contract.getPollMeta(id);
    const results = await contract.getPollResults(id);
    polls.push({
      id,
      question:  meta.question,
      costGCH:   Number(meta.costGCH),
      active:    meta.active,
      endsAt:    Number(meta.endsAt),
      options:   results.labels.map((label, i) => ({
        index: i, label, votes: Number(results.voteCounts[i]),
      })),
    });
  }
  return polls;
}

// ─── Load all active polls from contract ──────────────────────────────────────
export async function fetchPolls(provider) {
  const contract = getContract(provider);
  const count    = Number(await contract.pollCount());
  const polls    = [];
  for (let id = 1; id <= count; id++) {
    const meta    = await contract.getPollMeta(id);
    if (!meta.active) continue;
    const results = await contract.getPollResults(id);
    polls.push({
      id,
      question:   meta.question,
      costGCH:    Number(meta.costGCH),
      active:     meta.active,
      endsAt:     Number(meta.endsAt),
      options:    results.labels.map((label, i) => ({
        index:  i,
        label,
        votes:  Number(results.voteCounts[i]),
      })),
    });
  }
  return polls;
}
