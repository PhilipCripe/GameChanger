import { useState } from "react";
import { ethers } from "ethers";
import { getContract, getSigner, getProvider, formatGCH } from "../../utils/contract";

export default function Modders() {
  const [lookup,       setLookup]       = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading,setLookupLoading]= useState(false);

  const [creditAddr,   setCreditAddr]   = useState("");
  const [creditAmt,    setCreditAmt]    = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [crediting,    setCrediting]    = useState(false);
  const [creditMsg,    setCreditMsg]    = useState(null);

  async function handleLookup() {
    if (!ethers.isAddress(lookup)) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const c = getContract(getProvider());
      const [balance, earnings] = await Promise.all([
        c.getBalance(lookup),
        c.modderEarnings(lookup),
      ]);
      setLookupResult({
        address:  lookup,
        balance:  Number(balance),
        earnings: Number(earnings),
      });
    } catch { setLookupResult({ error: true }); }
    finally { setLookupLoading(false); }
  }

  async function handleCredit() {
    if (!ethers.isAddress(creditAddr) || !creditAmt || !creditReason.trim()) return;
    setCrediting(true);
    setCreditMsg(null);
    try {
      const signer   = await getSigner();
      const contract = getContract(signer);
      const tx = await contract.creditModder(creditAddr, BigInt(creditAmt), creditReason.trim());
      await tx.wait();
      setCreditMsg({ ok: true, text: `Credited ${creditAmt} GCH to ${creditAddr.slice(0, 8)}…` });
      setCreditAddr(""); setCreditAmt(""); setCreditReason("");
      // Refresh lookup if same address
      if (lookup.toLowerCase() === creditAddr.toLowerCase()) handleLookup();
    } catch (e) {
      setCreditMsg({ ok: false, text: e.reason || e.message || "Failed" });
    } finally { setCrediting(false); }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black">Modders</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Look up modder balances and manually credit GCH earnings.
          </p>
        </div>

        {/* Lookup */}
        <div className="card mb-6">
          <h2 className="font-bold mb-4">Wallet Lookup</h2>
          <div className="flex gap-3">
            <input
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              className="input flex-1 font-mono text-sm"
              placeholder="0x…"
            />
            <button
              onClick={handleLookup}
              disabled={lookupLoading || !ethers.isAddress(lookup)}
              className="btn-secondary shrink-0"
            >
              {lookupLoading ? "…" : "Look Up"}
            </button>
          </div>
          {lookupResult && (
            <div className="mt-4">
              {lookupResult.error ? (
                <p className="text-sm text-red-400">Could not fetch data for this address.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">GCH Balance</p>
                    <p className="text-xl font-black text-white">{lookupResult.balance.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">Total Earned (modder)</p>
                    <p className="text-xl font-black text-brand-500">{lookupResult.earnings.toLocaleString()}</p>
                  </div>
                  <div className="col-span-2 bg-gray-800 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">Estimated USD (at 1 GCH = $1)</p>
                    <p className="text-lg font-bold">${lookupResult.earnings.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Credit */}
        <div className="card">
          <h2 className="font-bold mb-1">Credit GCH to Modder</h2>
          <p className="text-xs text-gray-500 mb-5">
            Credits GCH to a modder's on-chain balance. Mints new tokens — use for off-chain contributions,
            revenue share payouts, or bonuses.
          </p>

          {creditMsg && (
            <div className={`mb-4 p-3 rounded-xl text-sm ${creditMsg.ok ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>
              {creditMsg.text}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 font-semibold block mb-1.5">Modder Wallet Address</label>
              <input
                value={creditAddr}
                onChange={(e) => setCreditAddr(e.target.value)}
                className="input font-mono text-sm"
                placeholder="0x…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1.5">GCH Amount</label>
                <input
                  type="number" min="1"
                  value={creditAmt}
                  onChange={(e) => setCreditAmt(e.target.value)}
                  className="input"
                  placeholder="500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1.5">Estimated USD</label>
                <div className="input bg-gray-800/50 text-gray-400 cursor-default">
                  ${creditAmt ? Number(creditAmt).toLocaleString() : "0"}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold block mb-1.5">Reason (stored on-chain)</label>
              <input
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="input"
                placeholder="Q1 2024 Bayraktar skin revenue share"
              />
            </div>
          </div>

          <button
            onClick={handleCredit}
            disabled={crediting || !ethers.isAddress(creditAddr) || !creditAmt || !creditReason.trim()}
            className="btn-primary mt-5"
          >
            {crediting ? "Crediting…" : "Credit GCH"}
          </button>
        </div>

        {/* Info callout */}
        <div className="mt-6 p-4 rounded-xl bg-blue-900/20 border border-blue-700/30 text-xs text-blue-300">
          <p className="font-bold mb-1">On-chain vs. USD payouts</p>
          <p>
            This panel credits on-chain GCH. For USD payouts (GCH → USD via Tether WDK),
            the modder initiates from their Modder Hub dashboard. Each listing can have an
            automatic per-sale share set via the Listings panel (modder address + modderBps).
          </p>
        </div>
      </div>
    </div>
  );
}
