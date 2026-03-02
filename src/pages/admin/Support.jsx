import { useState, useEffect } from "react";
import { useAdmin } from "../../hooks/useAdmin";
import { getProvider } from "../../utils/contract";
import { ethers } from "ethers";

export default function Support() {
  const { getToken } = useAdmin();

  const [tickets,      setTickets]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [gasAddress,   setGasAddress]   = useState(null);
  const [gasBalance,   setGasBalance]   = useState(null);
  const [resolving,    setResolving]    = useState(null);
  const [filter,       setFilter]       = useState("open"); // "open" | "all"

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/support", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setTickets(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function loadGasWallet() {
    try {
      const provider = getProvider();
      // The gas wallet address is returned in any ticket that has one
      // We can also fetch it from the first ticket that has gasWalletAddress
      const res  = await fetch("/api/admin/support", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const all = await res.json();
      const addr = all.find((t) => t.gasWalletAddress)?.gasWalletAddress;
      if (addr) {
        setGasAddress(addr);
        const bal = await provider.getBalance(addr);
        setGasBalance(ethers.formatEther(bal));
      }
    } catch { /* contract not deployed or no tickets yet */ }
  }

  useEffect(() => { load(); loadGasWallet(); }, []);

  async function handleResolve(ticket) {
    setResolving(ticket.id);
    try {
      await fetch("/api/admin/support", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ id: ticket.id, resolved: !ticket.resolved }),
      });
      await load();
    } finally { setResolving(null); }
  }

  const displayed = filter === "open"
    ? tickets.filter((t) => !t.resolved)
    : tickets;

  const openCount = tickets.filter((t) => !t.resolved).length;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black flex items-center gap-3">
            Support Tickets
            {openCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-bold">
                {openCount} open
              </span>
            )}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Tickets created when NFT minting fails due to low gas wallet balance.
          </p>
        </div>

        {/* Gas wallet card */}
        <div className="card mb-6 border-yellow-700/30">
          <h2 className="font-bold mb-3">Platform Gas Wallet</h2>
          <p className="text-xs text-gray-400 mb-4">
            This wallet pays AVAX gas fees when minting NFTs for email users who buy with USD.
            Keep it topped up. Replenish by sending AVAX to the address below.
          </p>
          {gasAddress ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-800 rounded-xl px-4 py-3 font-mono text-sm text-gray-300 break-all">
                  {gasAddress}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(gasAddress)}
                  className="btn-secondary text-xs shrink-0"
                >
                  Copy
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">AVAX Balance</p>
                  <p className={`text-xl font-black ${
                    gasBalance !== null && parseFloat(gasBalance) < 0.01
                      ? "text-red-400"
                      : "text-white"
                  }`}>
                    {gasBalance !== null ? `${parseFloat(gasBalance).toFixed(4)} AVAX` : "…"}
                  </p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Minimum recommended</p>
                  <p className="text-xl font-black text-gray-300">0.05 AVAX</p>
                </div>
              </div>
              {gasBalance !== null && parseFloat(gasBalance) < 0.005 && (
                <div className="p-3 rounded-xl bg-red-900/20 border border-red-700/30 text-xs text-red-400">
                  Gas wallet balance is critically low. NFT minting for email purchases is paused until replenished.
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-800 rounded-xl p-4">
              <p className="font-semibold mb-1">GAS_WALLET_PRIVATE_KEY not configured</p>
              <p>
                Set it as a Cloudflare Pages secret:{" "}
                <code className="text-xs bg-gray-700 px-1 rounded">
                  wrangler pages secret put GAS_WALLET_PRIVATE_KEY
                </code>
              </p>
              <p className="mt-2">
                Then call{" "}
                <code className="text-xs bg-gray-700 px-1 rounded">setMinter(gasWalletAddress)</code>{" "}
                on the contract to authorise it.
              </p>
            </div>
          )}
        </div>

        {/* Tickets */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {["open", "all"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  filter === f
                    ? "bg-avax-red border-avax-red text-white"
                    : "border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                {f === "open" ? `Open (${openCount})` : `All (${tickets.length})`}
              </button>
            ))}
          </div>
          <button onClick={load} className="text-xs text-gray-500 hover:text-white transition-colors">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="card h-24 animate-pulse bg-gray-800/50" />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">
            {filter === "open" ? "No open tickets." : "No tickets yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((t) => (
              <div
                key={t.id}
                className={`card ${t.resolved ? "opacity-50" : "border-yellow-700/30"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`badge text-xs ${
                        t.resolved
                          ? "bg-gray-800 text-gray-500"
                          : "bg-yellow-900/30 text-yellow-400"
                      }`}>
                        {t.resolved ? "Resolved" : "Open"}
                      </span>
                      <span className="text-sm font-semibold truncate">{t.email}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(t.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {t.listingName && (
                      <p className="text-sm text-gray-300 mb-1">
                        Item: <span className="font-semibold">{t.listingName}</span>
                        {t.displayCode && (
                          <span className="ml-2 font-mono text-xs text-gray-500">({t.displayCode})</span>
                        )}
                      </p>
                    )}

                    {t.walletAddress && (
                      <p className="text-xs text-gray-500 font-mono mb-1">
                        Wallet: {t.walletAddress}
                      </p>
                    )}

                    {t.message && (
                      <p className="text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2 mt-2">
                        {t.message}
                      </p>
                    )}

                    {t.error && (
                      <p className="text-xs text-red-400 bg-red-900/10 rounded-lg px-3 py-2 mt-2">
                        Error: {t.error}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleResolve(t)}
                    disabled={resolving === t.id}
                    className="btn-secondary text-xs shrink-0"
                  >
                    {resolving === t.id ? "…" : t.resolved ? "Reopen" : "Mark Resolved"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
