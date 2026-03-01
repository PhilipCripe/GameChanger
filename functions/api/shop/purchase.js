import { ethers } from "ethers";
import { json, options, getSession } from "../auth/_auth.js";

const LISTING_ABI = [
  "function getListing(uint256 id) view returns (string name, string sku, uint8 category, uint256 priceGCH, uint256 supply, uint256 sold, address modder, uint16 modderBps, bool active, uint64 expiresAt)",
];

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

  // Fetch listing price from on-chain contract
  const rpcUrl = env.RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
  const contractAddress = env.CONTRACT_ADDRESS;
  if (!contractAddress) return json({ error: "CONTRACT_ADDRESS not configured" }, 503);

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
      id: Number(listingId),
      name: l.name,
      sku: l.sku,
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

  user.gchBalance -= listing.priceGCH;

  // Generate random bytes32 redeem code
  const codeBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeHex = "0x" + Array.from(codeBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const displayCode = codeHex.slice(2, 20).toUpperCase();

  user.purchases = user.purchases || [];
  user.purchases.push({
    listingId: listing.id,
    code: codeHex,
    displayCode,
    purchasedAt: Date.now(),
  });

  await kv.put(`user:${session.email}`, JSON.stringify(user));

  return json({ code: displayCode, listing, newBalance: user.gchBalance });
}
