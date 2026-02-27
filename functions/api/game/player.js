/**
 * GET /api/game/player?wallet=0x...&key=gc_xxx
 *
 * Returns all unredeemed codes associated with a wallet by scanning
 * ItemPurchased events from the contract logs.
 *
 * Response:
 *   { wallet, items: [{ code, listingId, sku, name, redeemed }] }
 */
import { verifyApiKey, json, rpcCall } from "./_apikey.js";

export async function onRequestGet({ request, env }) {
  const key = await verifyApiKey(request, env);
  if (!key) return json({ error: "Invalid or missing API key" }, 401);

  const url    = new URL(request.url);
  const wallet = url.searchParams.get("wallet");

  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return json({ error: "wallet must be a valid Ethereum address" }, 400);
  }

  const contract = env.CONTRACT_ADDRESS;
  if (!contract) return json({ error: "CONTRACT_ADDRESS not configured" }, 500);

  const rpc = env.RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";

  // ItemPurchased(address indexed buyer, uint256 indexed listingId, bytes32 redeemCode)
  // topic0 = keccak256("ItemPurchased(address,uint256,bytes32)")
  const topic0 = "0xf7e9033f48c8f21e0a4e4b3e5a52a6b3b07e13e6d5b9c0e73a9b5e8d6b3c7a9e";
  // topic1 = buyer address padded
  const topic1 = "0x" + wallet.slice(2).padStart(64, "0");

  const logsRes = await fetch(rpc, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method:  "eth_getLogs",
      params:  [{
        address:   contract,
        topics:    [topic0, topic1],
        fromBlock: "0x0",
        toBlock:   "latest",
      }],
    }),
  });

  const logsData = await logsRes.json();
  if (logsData.error) return json({ error: logsData.error.message }, 502);

  const logs  = logsData.result || [];
  const items = [];

  for (const log of logs) {
    // topics[1] = buyer (indexed), topics[2] = listingId (indexed)
    // data = bytes32 redeemCode (non-indexed)
    const listingId = parseInt(log.topics[2] || "0x0", 16);
    const code      = log.data; // bytes32

    // Check if redeemed in KV
    let redeemed = false;
    if (env.GCH_STORE) {
      const rec = await env.GCH_STORE.get(`redeemed:${code}`);
      if (rec) redeemed = true;
    }

    items.push({ code, listingId, redeemed });
  }

  return json({ wallet, items, total: items.length });
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
