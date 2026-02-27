/**
 * Shared admin authentication helper for Cloudflare Functions.
 * Checks the Authorization: Bearer <token> header against the ADMIN_TOKEN secret.
 */
export function requireAdmin(request, env) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/, "");
  const valid  = token && env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
  return valid;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status:  401,
    headers: { "Content-Type": "application/json" },
  });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function options() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
