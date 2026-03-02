import { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { getContract, getProvider, formatGCH } from "../utils/contract";


export default function ModderDashboard() {
  const { address, connected, gchBalance, connect, refreshBalance } = useWallet();
  const [earnings,    setEarnings]    = useState(null);
  const [totalMinted, setTotalMinted] = useState(null);
  const [sales,       setSales]       = useState([]);
  const [sellAmt,     setSellAmt]     = useState("500");
  const [selling,     setSelling]     = useState(false);
  const [sellTx,      setSellTx]      = useState(null);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    if (!address) return;
    async function load() {
      try {
        const provider = getProvider();
        const contract = getContract(provider);
        const [e, m] = await Promise.all([
          contract.modderEarnings(address),
          contract.totalGCHMinted(),
        ]);
        setEarnings(e);
        setTotalMinted(m);

        // Load real sales from ModderSharePaid events for this modder
        const events = await contract.queryFilter(
          contract.filters.ModderSharePaid(address),
          0
        );
        const realSales = events.map((ev) => ({
          skin: ev.args.sku || ev.args.listingId?.toString() || "—",
          buyer: ev.args.buyer
            ? ev.args.buyer.slice(0, 6) + "…" + ev.args.buyer.slice(-4)
            : "—",
          gch: Number(ev.args.gchAmount),
          date: new Date(Number(ev.args.timestamp || 0) * 1000)
            .toISOString().slice(0, 10),
          block: ev.blockNumber,
        })).reverse(); // newest first
        setSales(realSales);
      } catch { /* contract not yet deployed */ }
    }
    load();
  }, [address]);

  async function handleSell() {
    // Simulate GCH → USD payout (WDK bridge in production)
    setSelling(true);
    setError(null);
    setSellTx(null);
    await new Promise((r) => setTimeout(r, 1800));
    setSellTx("PAYOUT-" + Date.now());
    setSelling(false);
  }

  const gchNum      = Math.max(0, parseInt(sellAmt) || 0);
  const usdEstimate = gchNum.toLocaleString(); // 1 GCH = $1 USD

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <span className="badge bg-green-900/40 text-green-400 mb-3">Modder Hub</span>
        <h1 className="text-3xl font-black mb-2">Modder Dashboard</h1>
        <p className="text-gray-400 text-sm">Track earnings, sell GCH tokens, and manage your skin creations.</p>
      </div>

      {!connected ? (
        <div className="card text-center py-16">
          <p className="text-gray-400 mb-4">Connect your wallet to view your modder dashboard</p>
          <button onClick={connect} className="btn-primary">Connect Wallet</button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div className="card">
              <p className="text-xs text-gray-400 mb-1">Total Earned</p>
              <p className="text-2xl font-black text-brand-500">
                {earnings === null ? "…" : formatGCH(earnings)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {earnings === null ? "" : `≈ $${Number(earnings).toLocaleString()} USD`}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-400 mb-1">GCH Balance</p>
              <p className="text-2xl font-black text-white">{formatGCH(gchBalance)}</p>
              <p className="text-xs text-gray-500 mt-1">Available to sell</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-400 mb-1">Protocol Minted</p>
              <p className="text-2xl font-black text-white">
                {totalMinted === null ? "…" : Number(totalMinted).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total GCH minted</p>
            </div>
          </div>

          {/* Sell GCH */}
          <div className="card mb-8">
            <h2 className="font-bold text-lg mb-4">Sell GCH → USD</h2>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-400 block mb-2">GCH to sell</label>
                <input
                  type="number"
                  min="1"
                  value={sellAmt}
                  onChange={(e) => setSellAmt(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-xl font-black focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="card bg-gray-800 border-gray-700 text-center min-w-[120px]">
                <p className="text-xs text-gray-400">You receive</p>
                <p className="text-xl font-black text-green-400">${usdEstimate}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 mb-4">
              Rate: 1 GCH = $1 USD · Payout via Tether WDK to your preferred wallet
            </p>
            <button onClick={handleSell} disabled={selling || gchNum <= 0} className="btn-primary">
              {selling ? "Processing payout…" : `Sell ${gchNum.toLocaleString()} GCH → $${usdEstimate}`}
            </button>
            {sellTx && (
              <p className="mt-3 text-xs text-green-400 bg-green-900/20 p-2 rounded-lg">
                Payout initiated! Reference: {sellTx}
              </p>
            )}
          </div>

          {/* Recent sales */}
          <div className="card">
            <h2 className="font-bold text-lg mb-4">Recent Sales</h2>
            {sales.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                {earnings === null ? "Loading…" : "No sales recorded on-chain yet."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-800">
                      <th className="pb-3 font-semibold">Item</th>
                      <th className="pb-3 font-semibold">Buyer</th>
                      <th className="pb-3 font-semibold text-right">GCH</th>
                      <th className="pb-3 font-semibold text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {sales.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                        <td className="py-3 font-medium">{s.skin}</td>
                        <td className="py-3 text-gray-400 font-mono text-xs">{s.buyer}</td>
                        <td className="py-3 text-right text-brand-500 font-bold">+{s.gch}</td>
                        <td className="py-3 text-right text-gray-400">{s.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
