import { useState, useEffect } from "react";
import { useAdmin } from "../../hooks/useAdmin";

const SOCIALS = [
  { key: "twitter",   label: "X/Twitter",  icon: "🐦" },
  { key: "youtube",   label: "YouTube",    icon: "▶️" },
  { key: "twitch",    label: "Twitch",     icon: "🟣" },
  { key: "discord",   label: "Discord",    icon: "💬" },
  { key: "instagram", label: "Instagram",  icon: "📷" },
];

export default function Users() {
  const { authHeaders } = useAdmin();
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [sending,  setSending]  = useState(null); // email of user being sent to
  const [sendAmt,  setSendAmt]  = useState("");
  const [msg,      setMsg]      = useState(null);
  const [expanded, setExpanded] = useState(null); // email of expanded row

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { headers: authHeaders });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend(email) {
    const amt = Number(sendAmt);
    if (!amt || amt <= 0) return;
    setMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method:  "POST",
        headers: authHeaders,
        body:    JSON.stringify({ toEmail: email, amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: data.error }); return; }
      setMsg({ ok: true, text: `Sent ${amt} GCH to ${email}` });
      setSending(null);
      setSendAmt("");
      await load();
    } catch {
      setMsg({ ok: false, text: "Failed to send" });
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.username || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">Users</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              All registered accounts. Send GCH prizes to players and content creators.
            </p>
          </div>
          <span className="badge bg-gray-800 text-gray-400 text-sm px-3 py-1.5">
            {users.length} users
          </span>
        </div>

        {msg && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${msg.ok ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>
            {msg.text}
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or username…"
            className="input w-full max-w-sm"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map((i) => <div key={i} className="card h-14 animate-pulse bg-gray-800/50" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-10 text-gray-500">No users found.</div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800">
                <tr className="text-left text-xs text-gray-400">
                  {["Username", "Email", "Balance", "Role", "Joined", "Socials", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((u) => (
                  <>
                    <tr
                      key={u.email}
                      className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                      onClick={() => setExpanded(expanded === u.email ? null : u.email)}
                    >
                      <td className="px-4 py-3 font-semibold">
                        {u.username
                          ? <span className="text-brand-400">@{u.username}</span>
                          : <span className="text-gray-600 italic">no pseudonym</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{u.email}</td>
                      <td className="px-4 py-3 font-bold text-avax-red">{(u.gchBalance || 0).toLocaleString()} GCH</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${u.role === "admin" ? "bg-avax-red/20 text-avax-red" : u.role === "modder" ? "bg-brand-900/30 text-brand-400" : "bg-gray-800 text-gray-400"}`}>
                          {u.role || "user"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {SOCIALS.filter((s) => u.socials?.[s.key]).map((s) => (
                            <span key={s.key} title={s.label} className="text-sm">{s.icon}</span>
                          ))}
                          {!SOCIALS.some((s) => u.socials?.[s.key]) && <span className="text-gray-700 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSending(u.email); setSendAmt(""); setMsg(null); }}
                          className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-semibold"
                        >
                          Send GCH
                        </button>
                      </td>
                    </tr>

                    {/* Send GCH inline form */}
                    {sending === u.email && (
                      <tr key={u.email + "-send"} className="bg-gray-800/40">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">Prize GCH for <strong className="text-white">{u.username ? `@${u.username}` : u.email}</strong>:</span>
                            <input
                              type="number"
                              min="1"
                              value={sendAmt}
                              onChange={(e) => setSendAmt(e.target.value)}
                              placeholder="Amount"
                              className="input w-32 py-1.5 text-sm"
                              autoFocus
                            />
                            <button onClick={() => handleSend(u.email)} disabled={!sendAmt} className="btn-primary text-xs py-1.5 px-4">
                              Send
                            </button>
                            <button onClick={() => setSending(null)} className="text-xs text-gray-500 hover:text-white">
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Expanded socials detail */}
                    {expanded === u.email && sending !== u.email && (
                      <tr key={u.email + "-expanded"} className="bg-gray-800/20">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {u.bio && (
                              <div className="col-span-2 text-gray-400 italic">"{u.bio}"</div>
                            )}
                            {u.walletAddress && (
                              <div className="text-gray-500 font-mono">
                                Wallet: {u.walletAddress.slice(0,8)}…{u.walletAddress.slice(-6)}
                              </div>
                            )}
                            {SOCIALS.map((s) => u.socials?.[s.key] ? (
                              <div key={s.key} className="text-gray-400">
                                {s.icon} {s.label}: <span className="text-white">{u.socials[s.key]}</span>
                              </div>
                            ) : null)}
                            {!u.bio && !SOCIALS.some((s) => u.socials?.[s.key]) && (
                              <div className="text-gray-600 col-span-2">No bio or socials added.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
