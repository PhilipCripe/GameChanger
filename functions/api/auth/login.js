import { json, options, hashPassword, createSession } from "./_auth.js";

export async function onRequestOptions() { return options(); }

export async function onRequestPost({ request, env }) {
  const kv = env.GCH_STORE;
  if (!kv) return json({ error: "KV not configured" }, 503);

  let email, password;
  try {
    ({ email, password } = await request.json());
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!email || !password) {
    return json({ error: "Email and password required" }, 400);
  }

  const userRaw = await kv.get(`user:${email}`);
  if (!userRaw) return json({ error: "Invalid credentials" }, 401);

  const user = JSON.parse(userRaw);
  const hash = await hashPassword(password, user.salt);

  if (hash !== user.passwordHash) {
    return json({ error: "Invalid credentials" }, 401);
  }

  const token = await createSession(email, kv);
  return json({ token, email });
}
