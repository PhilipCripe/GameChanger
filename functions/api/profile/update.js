import { json, options, getSession } from "../auth/_auth.js";

export async function onRequestOptions() { return options(); }

/** POST /api/profile/update — update username, bio, socials for the logged-in user */
export async function onRequestPost({ request, env }) {
  const kv = env.GCH_STORE;
  if (!kv) return json({ error: "KV not configured" }, 503);

  const session = await getSession(request, kv);
  if (!session) return json({ error: "Unauthorized" }, 401);

  let username, bio, socials;
  try {
    ({ username, bio, socials } = await request.json());
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const userRaw = await kv.get(`user:${session.email}`);
  if (!userRaw) return json({ error: "User not found" }, 404);
  const user = JSON.parse(userRaw);

  if (username !== undefined) {
    if (username !== "" && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return json(
        { error: "Username must be 3–30 characters: letters, numbers, underscores only" },
        400
      );
    }
    // Check uniqueness across all users
    if (username && username.toLowerCase() !== (user.username || "").toLowerCase()) {
      const list = await kv.list({ prefix: "user:" });
      for (const { name } of list.keys) {
        if (name === `user:${session.email}`) continue;
        const raw = await kv.get(name);
        if (!raw) continue;
        const other = JSON.parse(raw);
        if (other.username && other.username.toLowerCase() === username.toLowerCase()) {
          return json({ error: "Username already taken" }, 409);
        }
      }
    }
    user.username = username;
  }

  if (bio !== undefined) {
    user.bio = String(bio).slice(0, 300);
  }

  if (socials !== undefined) {
    user.socials = {
      twitter:   String(socials.twitter   || "").slice(0, 100),
      youtube:   String(socials.youtube   || "").slice(0, 100),
      twitch:    String(socials.twitch    || "").slice(0, 100),
      discord:   String(socials.discord   || "").slice(0, 100),
      instagram: String(socials.instagram || "").slice(0, 100),
    };
  }

  await kv.put(`user:${session.email}`, JSON.stringify(user));

  // Return safe profile (no password fields)
  const { passwordHash, salt, purchases, ...profile } = user;
  return json(profile);
}
