import { ethers } from "ethers";
import { json, options } from "./_auth.js";

export async function onRequestOptions() { return options(); }

/**
 * POST /api/admin/wallet-login
 * Body: { address, signature, message }
 * Verifies EIP-191 signature; if the recovered address matches ADMIN_WALLET,
 * returns the ADMIN_TOKEN so the client can authenticate subsequent requests.
 */
export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_TOKEN) {
    return json({ error: "Server not configured — set ADMIN_TOKEN secret" }, 500);
  }
  if (!env.ADMIN_WALLET) {
    return json({ error: "Server not configured — set ADMIN_WALLET variable" }, 500);
  }

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

  if (recovered.toLowerCase() !== env.ADMIN_WALLET.toLowerCase()) {
    // Constant-time-ish delay to slow enumeration
    await new Promise((r) => setTimeout(r, 400));
    return json({ error: "Wallet not authorised for admin access" }, 403);
  }

  return json({ success: true, token: env.ADMIN_TOKEN });
}
