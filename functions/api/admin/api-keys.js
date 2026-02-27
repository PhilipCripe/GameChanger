/**
 * GET    /api/admin/api-keys          → list all keys (masked)
 * POST   /api/admin/api-keys          → create new key  { name }
 * DELETE /api/admin/api-keys?id=xxx   → revoke key
 *
 * Keys are stored in KV under "apikey:<id>" as JSON.
 */
import { requireAdmin, unauthorized, json, options } from "./_auth.js";

const KV_PREFIX = "apikey:";

export async function onRequestOptions() { return options(); }

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return unauthorized();
  if (!env.GCH_STORE) return json({ error: "GCH_STORE KV not configured" }, 500);

  const list = await env.GCH_STORE.list({ prefix: KV_PREFIX });
  const keys = await Promise.all(
    list.keys.map(async ({ name }) => {
      const raw = await env.GCH_STORE.get(name, "json");
      return raw ? { ...raw, maskedKey: raw.keyPrefix + "…" + raw.keySuffix } : null;
    })
  );

  return json({ keys: keys.filter(Boolean) });
}

export async function onRequestPost({ request, env }) {
  if (!requireAdmin(request, env)) return unauthorized();
  if (!env.GCH_STORE) return json({ error: "GCH_STORE KV not configured" }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { name } = body;
  if (!name?.trim()) return json({ error: "name required" }, 400);

  const id       = crypto.randomUUID();
  const rawKey   = "gc_" + id.replace(/-/g, "").slice(0, 32);
  const record   = {
    id,
    name:      name.trim(),
    keyPrefix: rawKey.slice(0, 8),
    keySuffix: rawKey.slice(-4),
    // We store a hash of the key, not the plaintext, for security.
    // Verification compares hash(incoming key) === storedHash.
    keyHash:   await sha256(rawKey),
    active:    true,
    createdAt: new Date().toISOString(),
    lastUsed:  null,
  };

  await env.GCH_STORE.put(`${KV_PREFIX}${id}`, JSON.stringify(record));

  // Return the plaintext key ONCE – never stored in plaintext
  return json({ ok: true, key: rawKey, id, name: record.name });
}

export async function onRequestDelete({ request, env }) {
  if (!requireAdmin(request, env)) return unauthorized();
  if (!env.GCH_STORE) return json({ error: "GCH_STORE KV not configured" }, 500);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "id required" }, 400);

  await env.GCH_STORE.delete(`${KV_PREFIX}${id}`);
  return json({ ok: true });
}

async function sha256(str) {
  const buf    = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  const bytes  = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Called by game API functions to verify an incoming API key */
export async function verifyApiKey(key, env) {
  if (!env.GCH_STORE || !key?.startsWith("gc_")) return null;
  const list = await env.GCH_STORE.list({ prefix: KV_PREFIX });
  const hash = await sha256(key);
  for (const { name } of list.keys) {
    const rec = await env.GCH_STORE.get(name, "json");
    if (rec?.active && rec.keyHash === hash) {
      // Update lastUsed asynchronously
      env.GCH_STORE.put(name, JSON.stringify({ ...rec, lastUsed: new Date().toISOString() }));
      return rec;
    }
  }
  return null;
}
