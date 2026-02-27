/**
 * POST /api/admin/upload
 * Multipart form: file, type ("skin"|"content"), sku, listingId, desc
 *
 * Storage priority:
 *   1. Cloudflare R2 (if ASSETS_BUCKET binding configured)
 *   2. Cloudflare KV (base64 fallback, max ~10MB practical)
 */
import { requireAdmin, unauthorized, json, options } from "./_auth.js";

export async function onRequestOptions() { return options(); }

export async function onRequestPost({ request, env }) {
  if (!requireAdmin(request, env)) return unauthorized();

  let formData;
  try { formData = await request.formData(); }
  catch { return json({ error: "Invalid multipart form" }, 400); }

  const file      = formData.get("file");
  const type      = formData.get("type")      || "skin";
  const sku       = (formData.get("sku")      || "UNKNOWN").toUpperCase();
  const listingId = formData.get("listingId") || "";
  const desc      = formData.get("desc")      || "";

  if (!file || typeof file.arrayBuffer !== "function") {
    return json({ error: "No file provided" }, 400);
  }

  const ext    = getExt(file.name, file.type);
  const key    = `${type}/${sku}-${Date.now()}.${ext}`;
  const buffer = await file.arrayBuffer();

  // ── R2 storage ────────────────────────────────────────────────────────────
  if (env.ASSETS_BUCKET) {
    await env.ASSETS_BUCKET.put(key, buffer, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { sku, listingId, desc, uploadedAt: new Date().toISOString() },
    });
    // Assumes R2 bucket is bound to a public domain via a custom domain or Worker
    const publicUrl = env.ASSETS_BASE_URL
      ? `${env.ASSETS_BASE_URL}/${key}`
      : `/api/admin/asset?key=${encodeURIComponent(key)}`;
    return json({ ok: true, url: publicUrl, key, storage: "r2" });
  }

  // ── KV fallback (base64) ──────────────────────────────────────────────────
  if (env.GCH_STORE) {
    const bytes  = new Uint8Array(buffer);
    const binary = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
    const b64    = btoa(binary);
    const dataUrl = `data:${file.type || "application/octet-stream"};base64,${b64}`;

    await env.GCH_STORE.put(`asset:${key}`, dataUrl, {
      metadata: { sku, listingId, desc, name: file.name, uploadedAt: new Date().toISOString() },
    });
    return json({ ok: true, url: `/api/admin/asset?key=${encodeURIComponent(key)}`, key, storage: "kv" });
  }

  return json({ error: "No storage backend configured (ASSETS_BUCKET or GCH_STORE required)" }, 500);
}

// ── Serve KV-stored asset ─────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !env.GCH_STORE) return new Response("Not found", { status: 404 });

  const dataUrl = await env.GCH_STORE.get(`asset:${key}`);
  if (!dataUrl) return new Response("Not found", { status: 404 });

  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return new Response(bytes, {
    headers: {
      "Content-Type":  mime,
      "Cache-Control": "public, max-age=31536000",
    },
  });
}

function getExt(filename, mime) {
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5 && fromName !== filename) return fromName;
  const mimeMap = {
    "image/svg+xml":    "svg",
    "image/png":        "png",
    "image/webp":       "webp",
    "image/jpeg":       "jpg",
    "application/zip":  "zip",
    "application/pdf":  "pdf",
    "model/gltf-binary":"glb",
  };
  return mimeMap[mime] || "bin";
}
