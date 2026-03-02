import { ethers } from "ethers";
import { json, options, getSession } from "../auth/_auth.js";

const LISTING_ABI = [
  "function getListing(uint256 id) view returns (string name, string sku, uint8 category, uint256 priceGCH, uint256 supply, uint256 sold, address modder, uint16 modderBps, bool active, uint64 expiresAt)",
  "function mintItemTo(address recipient, uint256 listingId) returns (bytes32)",
  "event ItemPurchased(address indexed buyer, uint256 indexed listingId, bytes32 redeemCode)",
];

// Minimum AVAX required in gas wallet to attempt a mint (~2 transactions of headroom)
const MIN_AVAX = ethers.parseEther("0.005");

export async function onRequestOptions() { return options(); }

export async function onRequestPost({ request, env }) {
  const kv = env.GCH_STORE;
  if (!kv) return json({ error: "KV not configured" }, 503);

  const session = await getSession(request, kv);
  if (!session) return json({ error: "Unauthorized" }, 401);

  let listingId;
  try {
    ({ listingId } = await request.json());
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (listingId === undefined) return json({ error: "listingId required" }, 400);

  const rpcUrl          = env.RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
  const contractAddress = env.CONTRACT_ADDRESS;
  if (!contractAddress) return json({ error: "CONTRACT_ADDRESS not configured" }, 503);

  // Fetch listing from chain
  let listing;
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, LISTING_ABI, provider);
    const l = await contract.getListing(listingId);
    if (!l.active) return json({ error: "Listing is not active" }, 400);
    const now = Math.floor(Date.now() / 1000);
    if (Number(l.expiresAt) > 0 && Number(l.expiresAt) < now) {
      return json({ error: "Listing has expired" }, 400);
    }
    if (Number(l.supply) > 0 && Number(l.sold) >= Number(l.supply)) {
      return json({ error: "Listing is sold out" }, 400);
    }
    listing = {
      id:       Number(listingId),
      name:     l.name,
      sku:      l.sku,
      priceGCH: Number(l.priceGCH),
      category: Number(l.category),
    };
  } catch (e) {
    return json({ error: "Failed to fetch listing: " + e.message }, 500);
  }

  // Check and deduct KV GCH balance
  const userRaw = await kv.get(`user:${session.email}`);
  if (!userRaw) return json({ error: "User not found" }, 404);
  const user = JSON.parse(userRaw);

  if ((user.gchBalance || 0) < listing.priceGCH) {
    return json(
      { error: `Insufficient GCH balance (need ${listing.priceGCH}, have ${user.gchBalance || 0})` },
      402
    );
  }

  // Deduct GCH and record purchase
  user.gchBalance -= listing.priceGCH;

  const codeBytes  = crypto.getRandomValues(new Uint8Array(32));
  const codeHex    = "0x" + Array.from(codeBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const displayCode = codeHex.slice(2, 20).toUpperCase();

  user.purchases = user.purchases || [];
  const purchaseRecord = {
    listingId:   listing.id,
    listingName: listing.name,
    code:        codeHex,
    displayCode,
    purchasedAt: Date.now(),
    nftMinted:   false,
    txHash:      null,
  };
  user.purchases.push(purchaseRecord);

  // ── Attempt on-chain NFT mint via gas wallet ──────────────────────────────
  let contactSupport  = false;
  let gasWalletAddress = null;

  const gasKey = env.GAS_WALLET_PRIVATE_KEY;
  const recipientWallet = user.walletAddress;

  if (gasKey && recipientWallet) {
    try {
      const provider  = new ethers.JsonRpcProvider(rpcUrl);
      const gasWallet = new ethers.Wallet(gasKey, provider);
      gasWalletAddress = gasWallet.address;

      const gasBalance = await provider.getBalance(gasWallet.address);

      if (gasBalance < MIN_AVAX) {
        // Gas wallet is low — purchase is recorded but NFT needs manual minting
        contactSupport = true;
        // Store a support ticket in KV for the admin
        const ticket = {
          id:          `support:${Date.now()}:${session.email}`,
          email:       session.email,
          walletAddress: recipientWallet,
          listingId:   listing.id,
          listingName: listing.name,
          displayCode,
          gasWalletAddress,
          gasBalance:  gasBalance.toString(),
          createdAt:   Date.now(),
          resolved:    false,
        };
        await kv.put(ticket.id, JSON.stringify(ticket));
      } else {
        // Enough AVAX — mint the NFT
        const contract = new ethers.Contract(contractAddress, LISTING_ABI, gasWallet);
        const tx       = await contract.mintItemTo(recipientWallet, listingId);
        const receipt  = await tx.wait();

        purchaseRecord.nftMinted = true;
        purchaseRecord.txHash    = receipt.hash;
        user.purchases[user.purchases.length - 1] = purchaseRecord;
      }
    } catch (mintErr) {
      // Mint failed for an unexpected reason — flag for manual handling
      contactSupport = true;
      const ticket = {
        id:          `support:${Date.now()}:${session.email}`,
        email:       session.email,
        walletAddress: recipientWallet || null,
        listingId:   listing.id,
        listingName: listing.name,
        displayCode,
        gasWalletAddress,
        error:       mintErr.message,
        createdAt:   Date.now(),
        resolved:    false,
      };
      await kv.put(ticket.id, JSON.stringify(ticket));
    }
  }
  // If no gas wallet configured or no linked wallet, purchase is KV-only (no NFT)

  await kv.put(`user:${session.email}`, JSON.stringify(user));

  if (contactSupport) {
    return json({
      contactSupport: true,
      code:           displayCode,
      listing,
      newBalance:     user.gchBalance,
    }, 202); // 202 Accepted — purchase recorded, NFT pending
  }

  return json({ code: displayCode, listing, newBalance: user.gchBalance });
}
