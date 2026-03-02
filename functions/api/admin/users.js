import { requireAdmin, unauthorized, json, options } from "./_auth.js";

export async function onRequestOptions() { return options(); }

/** GET /api/admin/users — list all registered users */
export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return unauthorized();
  const kv = env.GCH_STORE;
  if (!kv) return json({ error: "KV not configured" }, 503);

  const list = await kv.list({ prefix: "user:" });
  const users = (
    await Promise.all(
      list.keys.map(async ({ name }) => {
        const raw = await kv.get(name);
        if (!raw) return null;
        const { email, username, gchBalance, role, socials, createdAt, walletAddress } =
          JSON.parse(raw);
        return {
          email,
          username:      username      || null,
          gchBalance:    gchBalance    || 0,
          role:          role          || "user",
          socials:       socials       || {},
          walletAddress: walletAddress || null,
          createdAt:     createdAt     || 0,
        };
      })
    )
  )
    .filter(Boolean)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return json(users);
}

/** POST /api/admin/users — send GCH prize to a user (admin mint, no deduction) */
export async function onRequestPost({ request, env }) {
  if (!requireAdmin(request, env)) return unauthorized();
  const kv = env.GCH_STORE;
  if (!kv) return json({ error: "KV not configured" }, 503);

  let toEmail, amount;
  try {
    ({ toEmail, amount } = await request.json());
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!toEmail || !amount || Number(amount) <= 0) {
    return json({ error: "toEmail and a positive amount are required" }, 400);
  }

  const recipientRaw = await kv.get(`user:${toEmail}`);
  if (!recipientRaw) return json({ error: "User not found" }, 404);

  const recipient = JSON.parse(recipientRaw);
  recipient.gchBalance = (recipient.gchBalance || 0) + Number(amount);
  await kv.put(`user:${toEmail}`, JSON.stringify(recipient));

  return json({ ok: true, toEmail, newBalance: recipient.gchBalance });
}
