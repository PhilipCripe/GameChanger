/**
 * Shared auth helpers for session-based auth CF Functions.
 */

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function options() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/** Parse Bearer token from Authorization header and verify session in KV. */
export async function getSession(request, kv) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/, "");
  if (!token) return null;
  const raw = await kv.get(`session:${token}`);
  if (!raw) return null;
  const session = JSON.parse(raw);
  if (session.expiresAt < Date.now()) return null;
  return session; // { email, expiresAt }
}

/** Generate a random hex string of `bytes` length. */
export function randomHex(bytes = 32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** PBKDF2-SHA256 hash of password using a given salt hex string. Returns hex. */
export async function hashPassword(password, saltHex) {
  const salt = Uint8Array.from(
    saltHex.match(/.{2}/g).map((b) => parseInt(b, 16))
  );
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Create a 7-day session token and store it in KV. Returns the token. */
export async function createSession(email, kv) {
  const token = randomHex(32);
  const session = { email, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  await kv.put(`session:${token}`, JSON.stringify(session), {
    expirationTtl: 7 * 24 * 60 * 60,
  });
  return token;
}
