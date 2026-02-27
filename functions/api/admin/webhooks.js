/**
 * GET  /api/admin/webhooks            → get current webhook config
 * POST /api/admin/webhooks            → save webhook config { url, secret }
 * GET  /api/admin/webhooks?action=test → send test event to configured webhook
 */
import { requireAdmin, unauthorized, json, options } from "./_auth.js";

const KV_KEY = "webhook:config";

export async function onRequestOptions() { return options(); }

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return unauthorized();
  if (!env.GCH_STORE)              return json({ error: "GCH_STORE not configured" }, 500);

  const action = new URL(request.url).searchParams.get("action");

  if (action === "test") {
    const config = await env.GCH_STORE.get(KV_KEY, "json");
    if (!config?.url) return json({ error: "No webhook URL configured" }, 400);
    return await sendWebhook(config, {
      event:     "TEST",
      message:   "GameChanger webhook test",
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  const config = await env.GCH_STORE.get(KV_KEY, "json");
  return json({ config: config ? { url: config.url, hasSecret: !!config.secret } : null });
}

export async function onRequestPost({ request, env }) {
  if (!requireAdmin(request, env)) return unauthorized();
  if (!env.GCH_STORE)              return json({ error: "GCH_STORE not configured" }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { url, secret } = body;
  if (!url) return json({ error: "url required" }, 400);

  try { new URL(url); } catch { return json({ error: "Invalid URL" }, 400); }

  await env.GCH_STORE.put(KV_KEY, JSON.stringify({ url, secret: secret || "" }));
  return json({ ok: true });
}

/**
 * Fire a webhook event. Used internally by game API functions on purchase/redeem.
 */
export async function fireWebhook(env, payload) {
  if (!env.GCH_STORE) return;
  const config = await env.GCH_STORE.get(KV_KEY, "json");
  if (!config?.url) return;
  // Fire-and-forget (non-blocking in CF Workers with waitUntil)
  sendWebhook(config, payload).catch(() => {});
}

async function sendWebhook(config, payload) {
  const body = JSON.stringify(payload);
  const headers = { "Content-Type": "application/json" };

  if (config.secret) {
    const sig = await hmacSha256(config.secret, body);
    headers["X-GC-Signature"] = sig;
  }

  try {
    const res = await fetch(config.url, { method: "POST", headers, body });
    return json({ ok: res.ok, status: res.status, url: config.url });
  } catch (e) {
    return json({ ok: false, error: e.message });
  }
}

async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig  = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
