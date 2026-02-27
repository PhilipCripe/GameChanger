/**
 * Shared helper: verify a game server API key from the X-GC-API-Key header.
 * Returns the key record or null.
 */
const KV_PREFIX = "apikey:";

export async function verifyApiKey(request, env) {
  const key = request.headers.get("X-GC-API-Key") ||
              new URL(request.url).searchParams.get("key");
  if (!key?.startsWith("gc_") || !env.GCH_STORE) return null;

  const hash = await sha256(key);
  const list = await env.GCH_STORE.list({ prefix: KV_PREFIX });
  for (const { name } of list.keys) {
    const rec = await env.GCH_STORE.get(name, "json");
    if (rec?.active && rec.keyHash === hash) {
      // Async last-used update
      env.GCH_STORE.put(name, JSON.stringify({ ...rec, lastUsed: new Date().toISOString() }));
      return rec;
    }
  }
  return null;
}

async function sha256(str) {
  const buf   = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/** Calls the Fuji RPC with an eth_call */
export async function rpcCall(env, to, data) {
  const rpc = env.RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
  const res = await fetch(rpc, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  return res.json();
}
