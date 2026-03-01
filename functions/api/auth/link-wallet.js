import { ethers } from "ethers";
import { json, options, getSession } from "./_auth.js";

export async function onRequestOptions() { return options(); }

export async function onRequestPost({ request, env }) {
  const kv = env.GCH_STORE;
  if (!kv) return json({ error: "KV not configured" }, 503);

  const session = await getSession(request, kv);
  if (!session) return json({ error: "Unauthorized" }, 401);

  let address, signature, message;
  try {
    ({ address, signature, message } = await request.json());
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!address || !signature || !message) {
    return json({ error: "address, signature, and message required" }, 400);
  }

  // Verify EIP-191 personal_sign signature
  let recovered;
  try {
    recovered = ethers.verifyMessage(message, signature);
  } catch {
    return json({ error: "Invalid signature" }, 401);
  }

  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return json({ error: "Signature does not match address" }, 401);
  }

  const userRaw = await kv.get(`user:${session.email}`);
  if (!userRaw) return json({ error: "User not found" }, 404);
  const user = JSON.parse(userRaw);
  user.walletAddress = address;
  await kv.put(`user:${session.email}`, JSON.stringify(user));

  return json({ ok: true, walletAddress: address });
}
