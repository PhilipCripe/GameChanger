/** Verify Stripe webhook signature (HMAC-SHA256). */
async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = sigHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const v1 = parts.find((p) => p.startsWith("v1="))?.split("=")[1];
  if (!timestamp || !v1) return false;

  const signed = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signed)
  );
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing attacks
  if (computed.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Webhook secret not configured", { status: 503 });
  }

  const payload = await request.text();
  const sigHeader = request.headers.get("stripe-signature") || "";

  const valid = await verifyStripeSignature(
    payload,
    sigHeader,
    env.STRIPE_WEBHOOK_SECRET
  );
  if (!valid) {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const { metadata } = event.data.object;
    const gchAmount = parseInt(metadata?.gchAmount) || 0;
    const email = metadata?.email;

    if (gchAmount > 0 && email && env.GCH_STORE) {
      const userRaw = await env.GCH_STORE.get(`user:${email}`);
      if (userRaw) {
        const user = JSON.parse(userRaw);
        user.gchBalance = (user.gchBalance || 0) + gchAmount;
        await env.GCH_STORE.put(`user:${email}`, JSON.stringify(user));
      }
    }
  }

  return Response.json({ received: true });
}
