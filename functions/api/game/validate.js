/**
 * GET /api/game/validate?code=0x...&key=gc_xxx
 *
 * Validates a redeem code against the contract via RPC.
 * Does NOT mark it used — call /api/game/redeem for that.
 *
 * Response:
 *   { valid: true,  listingId, sku, name, category }
 *   { valid: false, reason }
 */
import { verifyApiKey, json, rpcCall } from "./_apikey.js";

export async function onRequestGet({ request, env }) {
  const key = await verifyApiKey(request, env);
  if (!key) return json({ error: "Invalid or missing API key" }, 401);

  const url  = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code || !/^0x[0-9a-fA-F]{64}$/.test(code)) {
    return json({ error: "code must be a 0x-prefixed 32-byte hex string" }, 400);
  }

  const contract = env.CONTRACT_ADDRESS;
  if (!contract) return json({ error: "CONTRACT_ADDRESS not configured" }, 500);

  // isCodeValid(bytes32) → (bool valid, uint256 listingId)
  const selector = "0x4a28f47c";
  const data     = selector + code.slice(2).padStart(64, "0");
  const rpc      = await rpcCall(env, contract, data);

  if (rpc.error) return json({ error: rpc.error.message }, 502);

  const raw       = rpc.result?.slice(2) || "";
  const isValid   = raw.slice(0, 64) !== "0".repeat(64) && raw.slice(62, 64) === "01";
  const listingId = parseInt(raw.slice(64, 128) || "0", 16);

  if (!isValid || listingId === 0) {
    return json({ valid: false, reason: "Code invalid or already redeemed" });
  }

  // Fetch listing metadata
  const listingData = await fetchListing(env, contract, listingId);
  return json({ valid: true, listingId, ...listingData });
}

async function fetchListing(env, contract, id) {
  // getListing(uint256) selector
  const selector = "0x107046bd";
  const paddedId = id.toString(16).padStart(64, "0");
  const rpc      = await rpcCall(env, contract, selector + paddedId);
  if (rpc.error || !rpc.result) return {};

  // Decode ABI-encoded tuple: (string, string, uint8, uint256, uint256, uint256, address, uint16, bool, uint64)
  // We only extract what's practical without a full ABI decoder: category
  const raw      = rpc.result.slice(2);
  const category = parseInt(raw.slice(128, 192) || "0", 16);
  return { category };
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "X-GC-API-Key",
    },
  });
}
