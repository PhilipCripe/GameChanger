import { json, options } from "../auth/_auth.js";

function isAdmin(request, env) {
  const auth  = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  return token && token === env.ADMIN_TOKEN;
}

export async function onRequestOptions() { return options(); }

// GET  — list all support tickets
// POST — resolve a ticket  { id, resolved: true }
export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);

  const kv = env.GCH_STORE;
  if (!kv) return json({ error: "KV not configured" }, 503);

  const list = await kv.list({ prefix: "support:" });
  const tickets = await Promise.all(
    list.keys.map(async (k) => {
      const raw = await kv.get(k.name);
      try { return JSON.parse(raw); } catch { return null; }
    })
  );

  return json(
    tickets
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)
  );
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);

  const kv = env.GCH_STORE;
  if (!kv) return json({ error: "KV not configured" }, 503);

  let body;
  try { body = await request.json(); } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { id, resolved } = body;
  if (!id) return json({ error: "id required" }, 400);

  const raw = await kv.get(id);
  if (!raw) return json({ error: "Ticket not found" }, 404);

  const ticket = JSON.parse(raw);
  ticket.resolved   = !!resolved;
  ticket.resolvedAt = resolved ? Date.now() : null;
  await kv.put(id, JSON.stringify(ticket));

  return json({ ok: true, ticket });
}
