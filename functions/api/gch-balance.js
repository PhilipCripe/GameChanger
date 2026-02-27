/**
 * GET /api/gch-balance?address=0x...
 * Returns the GCH balance of an address from the Fuji RPC (no private keys needed).
 */
export async function onRequestGet({ request, env }) {
  const url     = new URL(request.url);
  const address = url.searchParams.get("address");

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return json({ error: "Invalid address" }, 400);
  }

  const rpc = env.RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
  const contractAddress = env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    return json({ error: "CONTRACT_ADDRESS not set" }, 500);
  }

  // ABI-encode getBalance(address)
  const selector = "0xf8b2cb4f"; // keccak256("getBalance(address)")[0:4]
  const paddedAddr = address.slice(2).padStart(64, "0");
  const data = selector + paddedAddr;

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id:      1,
    method:  "eth_call",
    params:  [{ to: contractAddress, data }, "latest"],
  });

  const res  = await fetch(rpc, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const rpcData = await res.json();

  if (rpcData.error) return json({ error: rpcData.error.message }, 502);

  const balanceBigInt = BigInt(rpcData.result || "0x0");
  return json({ address, balance: balanceBigInt.toString(), unit: "GCH" });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
