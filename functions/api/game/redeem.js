/**
 * POST /api/game/redeem
 * Headers: X-GC-API-Key: gc_xxx
 * Body:    { "code": "0xABC…" }
 *
 * Strategy:
 *   1. Verify API key
 *   2. Check code is valid via RPC (fast read)
 *   3. Mark as redeemed in KV immediately (instant, gasless)
 *   4. Fire webhook if configured
 *   5. Return listing info so the game can unlock the right item
 *
 * The on-chain contract.redeemCode() is a secondary reconciliation step
 * (no private key needed server-side; can be called by user's wallet separately).
 */
import { verifyApiKey, json, rpcCall } from "./_apikey.js";
import { fireWebhook }                 from "../admin/webhooks.js";

const KV_REDEEMED_PREFIX = "redeemed:";

export async function onRequestPost({ request, env }) {
  const key = await verifyApiKey(request, env);
  if (!key) return json({ error: "Invalid or missing API key" }, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { code } = body;
  if (!code || !/^0x[0-9a-fA-F]{64}$/.test(code)) {
    return json({ error: "code must be a 0x-prefixed 32-byte hex string" }, 400);
  }

  const contract = env.CONTRACT_ADDRESS;
  if (!contract) return json({ error: "CONTRACT_ADDRESS not configured" }, 500);

  // Check KV first (already redeemed via this API)
  if (env.GCH_STORE) {
    const existing = await env.GCH_STORE.get(`${KV_REDEEMED_PREFIX}${code}`);
    if (existing) return json({ error: "Code already redeemed", code }, 409);
  }

  // Verify on-chain
  const selector = "0x4a28f47c"; // isCodeValid(bytes32)
  const data     = selector + code.slice(2).padStart(64, "0");
  const rpc      = await rpcCall(env, contract, data);

  if (rpc.error) return json({ error: "RPC error: " + rpc.error.message }, 502);

  const raw       = rpc.result?.slice(2) || "";
  const isValid   = raw.slice(62, 64) === "01";
  const listingId = parseInt(raw.slice(64, 128) || "0", 16);

  if (!isValid || listingId === 0) {
    return json({ error: "Invalid or already redeemed code" }, 400);
  }

  // Fetch listing info for the response
  const listing = await fetchListingBasic(env, contract, listingId);

  // Mark in KV
  if (env.GCH_STORE) {
    await env.GCH_STORE.put(
      `${KV_REDEEMED_PREFIX}${code}`,
      JSON.stringify({ code, listingId, redeemedAt: new Date().toISOString(), apiKeyId: key.id }),
      { expirationTtl: 60 * 60 * 24 * 365 } // 1 year
    );
  }

  // Fire webhook
  await fireWebhook(env, {
    event:     "CODE_REDEEMED",
    code,
    listingId,
    sku:       listing.sku || "",
    name:      listing.name || "",
    timestamp: Math.floor(Date.now() / 1000),
  });

  return json({
    success:   true,
    code,
    listingId,
    sku:       listing.sku  || "",
    name:      listing.name || "",
    category:  listing.category ?? null,
  });
}

async function fetchListingBasic(env, contract, id) {
  // We call getListing and decode just sku + name (the first two string fields)
  const selector = "0x107046bd";
  const rpc      = await rpcCall(env, contract, selector + id.toString(16).padStart(64, "0"));
  if (rpc.error || !rpc.result) return {};
  // Minimal string ABI decode from offset layout
  try {
    const hex = rpc.result.slice(2);
    const decodeString = (offset) => {
      const lenHex = hex.slice(offset * 2, offset * 2 + 64);
      const len    = parseInt(lenHex, 16);
      const bytes  = hex.slice(offset * 2 + 64, offset * 2 + 64 + len * 2);
      return decodeHexToUtf8(bytes);
    };
    const nameOffset = parseInt(hex.slice(0, 64), 16);
    const skuOffset  = parseInt(hex.slice(64, 128), 16);
    const catHex     = hex.slice(128, 192);
    return {
      name:     decodeString(nameOffset),
      sku:      decodeString(skuOffset),
      category: parseInt(catHex, 16),
    };
  } catch { return {}; }
}

function decodeHexToUtf8(hex) {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || []);
  return new TextDecoder().decode(bytes);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-GC-API-Key",
    },
  });
}
