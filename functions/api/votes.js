/**
 * GET /api/votes
 * Returns current vote counts from the Fuji contract.
 */
export async function onRequestGet({ env }) {
  const rpc             = env.RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
  const contractAddress = env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    return json({ error: "CONTRACT_ADDRESS not set" }, 500);
  }

  // getVotes() selector
  const selector = "0xd4d7b19a"; // keccak256("getVotes()")[0:4]

  const res = await fetch(rpc, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method:  "eth_call",
      params:  [{ to: contractAddress, data: selector }, "latest"],
    }),
  });

  const data = await res.json();
  if (data.error) return json({ error: data.error.message }, 502);

  const hex = data.result || "0x" + "0".repeat(128);
  const raw = hex.slice(2);
  const leopard2 = BigInt("0x" + (raw.slice(0, 64)  || "0")).toString();
  const t90m     = BigInt("0x" + (raw.slice(64, 128) || "0")).toString();

  return json({ LEOPARD2: leopard2, T90M: t90m });
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
