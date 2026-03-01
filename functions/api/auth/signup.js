import { json, options, randomHex, hashPassword, createSession } from "./_auth.js";

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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Invalid email" }, 400);
  }
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters" }, 400);
  }

  const existing = await kv.get(`user:${email}`);
  if (existing) return json({ error: "Email already registered" }, 409);

  const saltHex = randomHex(16);
  const passwordHash = await hashPassword(password, saltHex);

  const user = {
    email,
    passwordHash,
    salt: saltHex,
    gchBalance: 0,
    purchases: [],
    createdAt: Date.now(),
  };
  await kv.put(`user:${email}`, JSON.stringify(user));

  const token = await createSession(email, kv);
  return json({ token, email });
}
