import { json, options, getSession } from "./_auth.js";

export async function onRequestOptions() { return options(); }

export async function onRequestGet({ request, env }) {
  const kv = env.GCH_STORE;
  if (!kv) return json({ error: "KV not configured" }, 503);

  const session = await getSession(request, kv);
  if (!session) return json({ error: "Unauthorized" }, 401);

  const userRaw = await kv.get(`user:${session.email}`);
  if (!userRaw) return json({ error: "User not found" }, 404);

  const { email, walletAddress, gchBalance, purchases, createdAt, username, bio, socials, role } =
    JSON.parse(userRaw);

  return json({
    email,
    walletAddress: walletAddress || null,
    gchBalance:    gchBalance    || 0,
    purchases:     purchases     || [],
    createdAt,
    username:      username      || null,
    bio:           bio           || "",
    socials:       socials       || {},
    role:          role          || "user",
  });
}
