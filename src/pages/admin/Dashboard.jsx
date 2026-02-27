import { useState, useEffect } from "react";
import { useAdmin } from "../../hooks/useAdmin";
import { useWallet } from "../../hooks/useWallet";
import { getContract, getProvider, CONTRACT_ADDRESS, FUJI_CHAIN_ID } from "../../utils/contract";

function Stat({ label, value, sub, accent }) {
  return (
    <div className="card">
      <p className={`text-2xl font-black ${accent || "text-white"}`}>{value ?? "…"}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { ownerAddress, token, saveToken, clearToken } = useAdmin();
  const { address } = useWallet();
  const [stats, setStats] = useState({});
  const [tokenInput, setTokenInput] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const c = getContract(getProvider());
        const [listingCount, pollCount, totalMinted, gchPerAvax] = await Promise.all([
          c.listingCount(),
          c.pollCount(),
          c.totalGCHMinted(),
          c.gchPerAvax(),
        ]);
        setStats({
          listingCount:  Number(listingCount),
          pollCount:     Number(pollCount),
          totalMinted:   Number(totalMinted).toLocaleString(),
          gchPerAvax:    Number(gchPerAvax).toLocaleString(),
        });
      } catch { /* ignore */ }
    }
    load();
  }, []);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Contract:{" "}
            <a
              href={`https://testnet.snowtrace.io/address/${CONTRACT_ADDRESS}`}
              target="_blank" rel="noreferrer"
              className="font-mono text-avax-red hover:underline"
            >
              {CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-6)}
            </a>
            {" "}· Chain {FUJI_CHAIN_ID}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat label="Listings"    value={stats.listingCount} />
          <Stat label="Polls"       value={stats.pollCount} />
          <Stat label="GCH Minted"  value={stats.totalMinted} accent="text-brand-500" />
          <Stat label="GCH / AVAX"  value={stats.gchPerAvax} />
        </div>

        {/* Contract info */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h2 className="font-bold mb-4 text-sm text-gray-400 uppercase tracking-wider">Contract Info</h2>
            <div className="space-y-3 text-sm">
              <Row label="Owner"   value={ownerAddress ? short(ownerAddress) : "…"} mono />
              <Row label="Network" value="Avalanche Fuji (43113)" />
              <Row label="Address" value={short(CONTRACT_ADDRESS)} mono />
              <Row label="Explorer"
                value={
                  <a href={`https://testnet.snowtrace.io/address/${CONTRACT_ADDRESS}`}
                     target="_blank" rel="noreferrer"
                     className="text-avax-red hover:underline">Snowtrace ↗</a>
                }
              />
            </div>
          </div>

          {/* Admin token setup */}
          <div className="card">
            <h2 className="font-bold mb-1 text-sm text-gray-400 uppercase tracking-wider">Server Auth Token</h2>
            <p className="text-xs text-gray-500 mb-4">
              Required for file uploads and API key management. Set via{" "}
              <code className="bg-gray-800 px-1 rounded">wrangler secret put ADMIN_TOKEN</code>.
            </p>
            {token ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 font-mono text-xs bg-gray-800 rounded px-3 py-2 text-green-400 overflow-hidden text-ellipsis whitespace-nowrap">
                  {"•".repeat(20)} (saved)
                </span>
                <button onClick={clearToken} className="btn-secondary text-xs py-1.5 px-3">Clear</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Paste ADMIN_TOKEN here…"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-avax-red"
                />
                <button
                  onClick={() => { saveToken(tokenInput); setTokenInput(""); }}
                  disabled={!tokenInput}
                  className="btn-primary text-xs py-2 px-4"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="card">
          <h2 className="font-bold mb-4 text-sm text-gray-400 uppercase tracking-wider">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/admin/listings"  className="btn-secondary text-xs">+ New Listing</a>
            <a href="/admin/polls"     className="btn-secondary text-xs">+ New Poll</a>
            <a href="/admin/uploads"   className="btn-secondary text-xs">↑ Upload Asset</a>
            <a href="/admin/game-api"  className="btn-secondary text-xs">⚙ Game API Keys</a>
            <a href={`https://faucet.avax.network`} target="_blank" rel="noreferrer" className="btn-secondary text-xs">Get Test AVAX ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className={`text-right truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
function short(addr) { return addr.slice(0, 8) + "…" + addr.slice(-6); }
