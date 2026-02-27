/**
 * POST /api/wdk-swap
 * Body: { fromChain, fromAmount, toAddress }
 *
 * Proxies to Tether WDK API to swap USDT/USDC/ETH/SOL/BTC → AVAX on Fuji.
 * Keeps the WDK API key server-side (never in the browser).
 */
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { fromChain, fromAmount, toAddress } = body;

  if (!fromChain || !fromAmount || !toAddress) {
    return json({ error: "Missing fields: fromChain, fromAmount, toAddress" }, 400);
  }

  const WDK_API  = env.WDK_API_URL  || "https://api.tether.to/v1/wdk";
  const WDK_KEY  = env.WDK_API_KEY  || "";

  // In production this calls the real Tether WDK endpoint
  // For the hackathon demo we return a simulated response
  if (!WDK_KEY) {
    return json({
      status:    "simulated",
      message:   "WDK_API_KEY not set – returning demo response",
      swap: {
        fromChain,
        fromAmount,
        toChain:   "AVAX_FUJI",
        toAddress,
        estimatedAVAX: (parseFloat(fromAmount) * 0.0005).toFixed(6),
        txId:      "WDK-DEMO-" + Date.now(),
      },
    });
  }

  const wdkRes = await fetch(`${WDK_API}/swap`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${WDK_KEY}`,
    },
    body: JSON.stringify({
      from_chain:  fromChain,
      from_amount: fromAmount,
      to_chain:    "AVAX",
      to_network:  "fuji",
      to_address:  toAddress,
    }),
  });

  const wdkData = await wdkRes.json();
  return json(wdkData, wdkRes.status);
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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
