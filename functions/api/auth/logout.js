import { json, options } from "./_auth.js";

export async function onRequestOptions() { return options(); }

export async function onRequestPost({ request, env }) {
  const kv = env.GCH_STORE;
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/, "");
  if (kv && token) await kv.delete(`session:${token}`);
  return json({ ok: true });
}
