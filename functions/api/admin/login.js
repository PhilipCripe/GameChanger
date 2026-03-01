import { json, options } from "./_auth.js";

export async function onRequestOptions() {
  return options();
}

/**
 * POST /api/admin/login
 * Body: { username: string, password: string }
 * Returns: { token } on success, 401 on failure.
 * The token is the ADMIN_TOKEN secret and is used as a Bearer
 * header for all subsequent admin API calls.
 */
export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();

    const validUser = (env.ADMIN_USERNAME || "admin");
    const validPass = env.ADMIN_TOKEN;

    if (!validPass) {
      return json({ error: "Server not configured — set ADMIN_TOKEN secret" }, 500);
    }

    if (username !== validUser || password !== validPass) {
      // Constant-time-ish delay to slow brute force
      await new Promise((r) => setTimeout(r, 400));
      return json({ error: "Invalid username or password" }, 401);
    }

    return json({ success: true, token: validPass });
  } catch {
    return json({ error: "Bad request" }, 400);
  }
}
