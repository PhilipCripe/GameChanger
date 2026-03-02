import { json, options, getSession } from "../auth/_auth.js";

export async function onRequestOptions() { return options(); }

export async function onRequestPost({ request, env }) {
  const kv = env.GCH_STORE;
  if (!kv) return json({ error: "KV not configured" }, 503);

  const session = await getSession(request, kv);
  if (!session) return json({ error: "Unauthorized" }, 401);

  let body;
  try { body = await request.json(); } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { message, listingId, listingName, displayCode } = body;
  if (!message?.trim()) return json({ error: "Message required" }, 400);

  const ticketId = `support:${Date.now()}:${session.email}`;
  const ticket = {
    id:          ticketId,
    email:       session.email,
    message:     message.trim(),
    listingId:   listingId   || null,
    listingName: listingName || null,
    displayCode: displayCode || null,
    createdAt:   Date.now(),
    resolved:    false,
    source:      "user_form",
  };

  await kv.put(ticketId, JSON.stringify(ticket));
  return json({ ok: true });
}
