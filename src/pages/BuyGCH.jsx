import { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { getContract, getSigner, getProvider, gchToWei, formatGCH } from "../utils/contract";
import { ethers } from "ethers";

const CHAINS = [
  { id: "avax", label: "AVAX",  icon: "🔴", note: "Native – direct"   },
  { id: "usdt", label: "USDT",  icon: "💵", note: "Tether WDK swap"   },
  { id: "usdc", label: "USDC",  icon: "🔵", note: "Tether WDK swap"   },
  { id: "eth",  label: "ETH",   icon: "⚪", note: "Tether WDK swap"   },
  { id: "sol",  label: "SOL",   icon: "🟣", note: "Tether WDK swap"   },
  { id: "btc",  label: "BTC",   icon: "🟡", note: "Tether WDK swap"   },
];

export default function BuyGCH() {
  const { connected, gchBalance, connect, refreshBalance } = useWallet();
  const [gchPerAvax, setGchPerAvax] = useState(1000n);
  const [payChain,   setPayChain]   = useState("avax");
  const [gchAmt,     setGchAmt]     = useState("1000");
  const [loading,    setLoading]    = useState(false);
  const [txHash,     setTxHash]     = useState(null);
  const [error,      setError]      = useState(null);

  // Fetch live rate from contract
  useEffect(() => {
    getContract(getProvider())
      .gchPerAvax()
      .then((r) => setGchPerAvax(r))
      .catch(() => {});
  }, []);

  const gchNum     = Math.max(0, parseInt(gchAmt) || 0);
  const avaxCost   = gchNum > 0
    ? Number(gchToWei(gchNum, gchPerAvax)) / 1e18
    : 0;

  async function handleBuy() {
    if (!connected) { connect(); return; }
    if (gchNum <= 0) { setError("Enter a valid GCH amount"); return; }
    setLoading(true);
    setError(null);
    setTxHash(null);
    try {
      if (payChain !== "avax") {
        // Tether WDK path – call our Cloudflare Function proxy
        const res = await fetch("/api/wdk-swap", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ fromChain: payChain, fromAmount: gchNum, toAddress: "self" }),
        });
        const data = await res.json();
        setTxHash(data.swap?.txId || "WDK-SIMULATED");
        await refreshBalance();
        return;
      }
      const signer   = await getSigner();
      const contract = getContract(signer);
      const value    = gchToWei(gchNum, gchPerAvax);
      const tx       = await contract.buyGCHWithAVAX(BigInt(gchNum), { value });
      const receipt  = await tx.wait();
      setTxHash(receipt.hash);
      await refreshBalance();
    } catch (e) {
      setError(e.reason || e.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-3xl font-black mb-2">Buy GCH Tokens</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Fund your wallet to purchase items, cast votes, or earn as a modder.
      </p>

      {/* Current balance */}
      {connected && (
        <div className="card mb-6 flex items-center justify-between">
          <span className="text-sm text-gray-400">Your Balance</span>
          <span className="font-black text-xl text-brand-500">{formatGCH(gchBalance)}</span>
        </div>
      )}

      {/* Pay with */}
      <div className="card mb-4">
        <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">Pay With</p>
        <div className="grid grid-cols-3 gap-2">
          {CHAINS.map((c) => (
            <button
              key={c.id}
              onClick={() => setPayChain(c.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-sm font-semibold transition-all ${
                payChain === c.id
                  ? "border-avax-red bg-avax-red/10 text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white"
              }`}
            >
              <span className="text-xl">{c.icon}</span>
              {c.label}
              <span className="text-[10px] text-gray-500 font-normal">{c.note}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="card mb-4">
        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-3">
          GCH Amount
        </label>
        <input
          type="number"
          min="1"
          step="100"
          value={gchAmt}
          onChange={(e) => setGchAmt(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-xl font-black focus:outline-none focus:border-avax-red"
        />
        <div className="flex justify-between mt-3 text-sm">
          <span className="text-gray-400">Cost in AVAX</span>
          <span className="font-semibold">{avaxCost.toFixed(4)} AVAX</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-400">Rate (live)</span>
          <span className="font-semibold">1 AVAX = {gchPerAvax.toLocaleString()} GCH</span>
        </div>
        <div className="flex gap-2 mt-4">
          {[500, 1000, 5000, 10000].map((v) => (
            <button
              key={v}
              onClick={() => setGchAmt(String(v))}
              className="flex-1 text-xs py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold border border-gray-700 transition-colors"
            >
              {v.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {payChain !== "avax" && (
        <div className="mb-4 p-3 rounded-xl bg-blue-900/20 border border-blue-700/30 text-xs text-blue-300">
          <strong>Tether WDK:</strong> Your {CHAINS.find((c) => c.id === payChain)?.label} is
          automatically bridged to AVAX on Fuji and GCH is credited to your wallet.
        </div>
      )}

      <button
        onClick={handleBuy}
        disabled={loading || gchNum <= 0}
        className="btn-primary w-full py-3 text-base"
      >
        {loading ? "Processing…"
          : connected ? `Buy ${gchNum.toLocaleString()} GCH`
          : "Connect Wallet"}
      </button>

      {error && <p className="mt-3 text-sm text-red-400 bg-red-900/20 p-3 rounded-xl">{error}</p>}
      {txHash && (
        <div className="mt-3 p-3 rounded-xl bg-green-900/20 border border-green-700/30 text-xs text-green-400">
          <p className="font-bold mb-1">Purchase confirmed!</p>
          {txHash.startsWith("WDK") ? (
            <p>WDK bridge initiated · ref: {txHash}</p>
          ) : (
            <a href={`https://testnet.snowtrace.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline break-all">
              View on Snowtrace ↗
            </a>
          )}
        </div>
      )}

      <p className="text-center text-xs text-gray-500 mt-6">
        Need test AVAX?{" "}
        <a href="https://faucet.avax.network" target="_blank" rel="noreferrer" className="text-avax-red underline">
          faucet.avax.network ↗
        </a>
      </p>
    </div>
  );
}
