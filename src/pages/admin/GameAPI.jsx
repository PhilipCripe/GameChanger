import { useState, useEffect } from "react";
import { useAdmin } from "../../hooks/useAdmin";

function Code({ children }) {
  return (
    <code className="block bg-gray-950 border border-gray-800 rounded-xl p-4 text-xs font-mono text-green-400 overflow-x-auto whitespace-pre">
      {children}
    </code>
  );
}

export default function GameAPI() {
  const { authHeaders, token } = useAdmin();
  const [keys,          setKeys]          = useState([]);
  const [keysLoading,   setKeysLoading]   = useState(true);
  const [newKeyName,    setNewKeyName]     = useState("");
  const [createdKey,    setCreatedKey]     = useState(null);
  const [creating,      setCreating]       = useState(false);
  const [webhookUrl,    setWebhookUrl]     = useState("");
  const [webhookSecret, setWebhookSecret]  = useState("");
  const [webhookSaving, setWebhookSaving]  = useState(false);
  const [webhookMsg,    setWebhookMsg]     = useState(null);
  const [testResult,    setTestResult]     = useState(null);
  const [testing,       setTesting]        = useState(false);

  const BASE = typeof window !== "undefined" ? window.location.origin : "https://gamechanger-market.pages.dev";

  async function loadKeys() {
    setKeysLoading(true);
    try {
      const res  = await fetch("/api/admin/api-keys", { headers: authHeaders });
      const data = await res.json();
      setKeys(Array.isArray(data.keys) ? data.keys : []);
    } catch { setKeys([]); }
    finally  { setKeysLoading(false); }
  }

  useEffect(() => { if (token) loadKeys(); else setKeysLoading(false); }, [token]);

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setCreatedKey(null);
    try {
      const res  = await fetch("/api/admin/api-keys", {
        method:  "POST",
        headers: authHeaders,
        body:    JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (data.key) { setCreatedKey(data.key); setNewKeyName(""); await loadKeys(); }
    } catch { /* ignore */ }
    finally { setCreating(false); }
  }

  async function handleRevokeKey(id) {
    if (!confirm("Revoke this API key?")) return;
    try {
      await fetch(`/api/admin/api-keys?id=${id}`, { method: "DELETE", headers: authHeaders });
      await loadKeys();
    } catch { /* ignore */ }
  }

  async function handleSaveWebhook() {
    setWebhookSaving(true);
    setWebhookMsg(null);
    try {
      const res  = await fetch("/api/admin/webhooks", {
        method:  "POST",
        headers: authHeaders,
        body:    JSON.stringify({ url: webhookUrl, secret: webhookSecret }),
      });
      const data = await res.json();
      setWebhookMsg({ ok: data.ok, text: data.ok ? "Webhook saved." : (data.error || "Failed") });
    } catch { setWebhookMsg({ ok: false, text: "Network error" }); }
    finally  { setWebhookSaving(false); }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res  = await fetch("/api/admin/webhooks?action=test", { headers: authHeaders });
      const data = await res.json();
      setTestResult(data);
    } catch (e) { setTestResult({ error: e.message }); }
    finally     { setTesting(false); }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-black">Game API</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Integrate GameChanger into your game server. Generate API keys, configure webhooks,
            and use the REST endpoints below.
          </p>
        </div>

        {!token && (
          <div className="p-4 rounded-xl bg-yellow-900/20 border border-yellow-700/30 text-sm text-yellow-300">
            Save your <strong>ADMIN_TOKEN</strong> on the Dashboard page to manage API keys and webhooks.
          </div>
        )}

        {/* API Key management */}
        <div className="card">
          <h2 className="font-bold mb-4">API Keys</h2>
          <div className="flex gap-3 mb-4">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
              className="input flex-1"
              placeholder="Key name (e.g. MyGame-Production)"
            />
            <button onClick={handleCreateKey} disabled={creating || !newKeyName.trim() || !token} className="btn-primary shrink-0">
              {creating ? "…" : "Generate Key"}
            </button>
          </div>

          {createdKey && (
            <div className="mb-4 p-4 rounded-xl bg-green-900/20 border border-green-700/30">
              <p className="text-xs text-green-400 font-bold mb-2">⚠ Copy this key now — it won't be shown again</p>
              <code className="block font-mono text-sm text-green-300 bg-gray-950 rounded-lg px-3 py-2 break-all">
                {createdKey}
              </code>
            </div>
          )}

          {keysLoading ? (
            <div className="animate-pulse h-12 bg-gray-800/50 rounded-xl" />
          ) : keys.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              {token ? "No API keys yet." : "Save ADMIN_TOKEN to manage keys."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800 text-left text-xs text-gray-400">
                <tr>
                  {["Name", "Key (masked)", "Created", "Last Used", ""].map(h => (
                    <th key={h} className="pb-2 pr-4 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-gray-800/20">
                    <td className="py-2.5 pr-4 font-medium">{k.name}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-gray-400">{k.maskedKey}</td>
                    <td className="py-2.5 pr-4 text-gray-400 text-xs">{new Date(k.createdAt).toLocaleDateString()}</td>
                    <td className="py-2.5 pr-4 text-gray-400 text-xs">{k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : "Never"}</td>
                    <td className="py-2.5">
                      <button onClick={() => handleRevokeKey(k.id)} className="text-xs text-red-400 hover:text-red-300">Revoke</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Webhook */}
        <div className="card">
          <h2 className="font-bold mb-1">Webhook</h2>
          <p className="text-xs text-gray-500 mb-4">
            GameChanger will POST to this URL when a purchase is made or a code is redeemed.
          </p>
          {webhookMsg && (
            <div className={`mb-3 p-3 rounded-xl text-sm ${webhookMsg.ok ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>
              {webhookMsg.text}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 font-semibold block mb-1.5">Endpoint URL</label>
              <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="input" placeholder="https://mygame.example.com/webhook/gamechanger" />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold block mb-1.5">Signing Secret (optional)</label>
              <input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} className="input" placeholder="Used to verify requests via X-GC-Signature header" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSaveWebhook} disabled={webhookSaving || !webhookUrl || !token} className="btn-primary">
              {webhookSaving ? "Saving…" : "Save Webhook"}
            </button>
            <button onClick={handleTest} disabled={testing || !token} className="btn-secondary">
              {testing ? "Testing…" : "Send Test Event"}
            </button>
          </div>
          {testResult && (
            <div className="mt-3 p-3 rounded-xl bg-gray-800 text-xs font-mono">
              <pre className="text-gray-300 whitespace-pre-wrap">{JSON.stringify(testResult, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* API Docs */}
        <div className="card">
          <h2 className="font-bold mb-4">REST Endpoints</h2>
          <p className="text-xs text-gray-400 mb-5">
            All game server endpoints require the header <code className="bg-gray-800 px-1 rounded">X-GC-API-Key: gc_xxx</code>.
          </p>
          <div className="space-y-6">

            <ApiEndpoint
              method="GET" path="/api/game/validate"
              desc="Check if a redeem code is valid and unused."
              example={`GET ${BASE}/api/game/validate?code=0xABC123&key=gc_xxx\n\n// Response\n{\n  "valid": true,\n  "listingId": 2,\n  "sku": "BAYRAKTAR",\n  "name": "Bayraktar TB2",\n  "category": 0\n}`}
            />

            <ApiEndpoint
              method="POST" path="/api/game/redeem"
              desc="Mark a code as redeemed. Call after unlocking the item in-game."
              example={`POST ${BASE}/api/game/redeem\nContent-Type: application/json\nX-GC-API-Key: gc_xxx\n\n{ "code": "0xABC123" }\n\n// Response\n{\n  "success": true,\n  "listingId": 2,\n  "sku": "BAYRAKTAR",\n  "name": "Bayraktar TB2"\n}`}
            />

            <ApiEndpoint
              method="GET" path="/api/game/player"
              desc="Get all unredeemed codes for a player's wallet."
              example={`GET ${BASE}/api/game/player?wallet=0x1234…&key=gc_xxx\n\n// Response\n{\n  "wallet": "0x1234…",\n  "items": [\n    { "code": "0xABC123", "sku": "BAYRAKTAR", "listingId": 2 }\n  ]\n}`}
            />

            <div className="p-4 rounded-xl bg-gray-800">
              <p className="text-xs text-gray-400 font-bold mb-3 uppercase tracking-wide">Webhook Payload</p>
              <Code>{`// POST to your webhook URL on every purchase:\n{\n  "event": "ITEM_PURCHASED",\n  "buyer": "0xABC…",\n  "listingId": 2,\n  "sku": "BAYRAKTAR",\n  "redeemCode": "0xDEF456…",\n  "timestamp": 1710000000\n}\n\n// POST on redeem:\n{\n  "event": "CODE_REDEEMED",\n  "code": "0xDEF456…",\n  "listingId": 2,\n  "sku": "BAYRAKTAR",\n  "timestamp": 1710000001\n}`}</Code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiEndpoint({ method, path, desc, example }) {
  const colors = { GET: "text-green-400 bg-green-900/30", POST: "text-blue-400 bg-blue-900/30" };
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`badge text-xs font-mono ${colors[method]}`}>{method}</span>
        <code className="text-sm font-mono text-gray-200">{path}</code>
      </div>
      <p className="text-xs text-gray-400 mb-2">{desc}</p>
      <Code>{example}</Code>
    </div>
  );
}
