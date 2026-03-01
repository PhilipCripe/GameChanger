import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useAuth }   from "../hooks/useAuth";
import { getContract, getSigner, getProvider, gchToWei, formatGCH } from "../utils/contract";

const CHAINS = [
  { id: "avax", label: "AVAX",  icon: "🔴", note: "Native – direct",   stable: false },
  { id: "usdt", label: "USDT",  icon: "💵", note: "Tether WDK swap",   stable: true  },
  { id: "usdc", label: "USDC",  icon: "🔵", note: "Tether WDK swap",   stable: true  },
  { id: "eth",  label: "ETH",   icon: "⚪", note: "Tether WDK swap",   stable: false },
  { id: "sol",  label: "SOL",   icon: "🟣", note: "Tether WDK swap",   stable: false },
  { id: "btc",  label: "BTC",   icon: "🟡", note: "Tether WDK swap",   stable: false },
  { id: "card", label: "Card",  icon: "💳", note: "USD via Stripe",    stable: true  },
];

// CoinGecko IDs for volatile assets
const GECKO_IDS = {
  avax: "avalanche-2",
  eth:  "ethereum",
  sol:  "solana",
  btc:  "bitcoin",
};

export default function BuyGCH() {
  const { connected, gchBalance, connect, refreshBalance } = useWallet();
  const { user, refreshUser, getToken } = useAuth();

  const [gchPerAvax, setGchPerAvax] = useState(1000n);
  const [payChain,   setPayChain]   = useState("avax");
  const [gchAmt,     setGchAmt]     = useState("1000");
  const [loading,    setLoading]    = useState(false);
  const [txHash,     setTxHash]     = useState(null);
  const [error,      setError]      = useState(null);

  // Live USD prices for volatile assets
  const [usdPrices, setUsdPrices] = useState({});

  // Card form fields (stub — real Stripe Elements added when key is configured)
  const [cardName, setCardName] = useState("");

  // Fetch live rate from contract
  useEffect(() => {
    getContract(getProvider())
      .gchPerAvax()
      .then((r) => setGchPerAvax(r))
      .catch(() => {});
  }, []);

  // Fetch CoinGecko prices (60s refresh)
  useEffect(() => {
    async function fetchPrices() {
      try {
        const ids = Object.values(GECKO_IDS).join(",");
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
        );
        if (!res.ok) return;
        const data = await res.json();
        setUsdPrices({
          avax: data["avalanche-2"]?.usd,
          eth:  data["ethereum"]?.usd,
          sol:  data["solana"]?.usd,
          btc:  data["bitcoin"]?.usd,
        });
      } catch {}
    }
    fetchPrices();
    const id = setInterval(fetchPrices, 60_000);
    return () => clearInterval(id);
  }, []);

  const gchNum   = Math.max(0, parseInt(gchAmt) || 0);
  const avaxCost = gchNum > 0 ? Number(gchToWei(gchNum, gchPerAvax)) / 1e18 : 0;
  const usdCost  = gchNum; // $1 = 1 GCH

  // USD equivalent for volatile chains
  function usdEquiv() {
    if (payChain === "usdt" || payChain === "usdc" || payChain === "card") {
      return `≈ $${usdCost.toLocaleString()} USD`;
    }
    const price = usdPrices[payChain];
    if (!price || payChain === "avax") {
      if (payChain === "avax" && usdPrices.avax) {
        return `≈ $${(avaxCost * usdPrices.avax).toFixed(2)} USD`;
      }
      return null;
    }
    // For WDK chains: approximate cost in that asset
    const assetCost = usdCost / price;
    return `≈ $${usdCost.toLocaleString()} USD`;
  }

  const isEmailUser  = !!user;
  const canBuyOnChain = connected;
  const isLoggedIn   = isEmailUser || canBuyOnChain;

  async function handleBuy() {
    if (!isLoggedIn) return;
    if (gchNum <= 0) { setError("Enter a valid GCH amount"); return; }
    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      if (payChain === "card") {
        // Stripe path
        const res = await fetch("/api/stripe/create-payment-intent", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ gchAmount: gchNum, email: user?.email }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Payment failed");
          return;
        }
        // clientSecret returned — would use Stripe.js here when key is configured
        // For now, show a placeholder success (real flow requires loadStripe)
        setTxHash("STRIPE-PENDING");
        return;
      }

      // Wallet-required paths
      if (!canBuyOnChain) {
        setError("Connect a wallet to buy with " + payChain.toUpperCase());
        return;
      }

      if (payChain !== "avax") {
        // Tether WDK path
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

      // Native AVAX path
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

  const chain = CHAINS.find((c) => c.id === payChain);

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-3xl font-black mb-2">Buy GCH Tokens</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Fund your account to purchase items, cast votes, or earn as a modder.
      </p>

      {/* Current balance */}
      {(connected || user) && (
        <div className="card mb-6 flex items-center justify-between">
          <span className="text-sm text-gray-400">Your Balance</span>
          <span className="font-black text-xl text-brand-500">
            {connected
              ? formatGCH(gchBalance)
              : `${(user?.gchBalance || 0).toLocaleString()} GCH`}
          </span>
        </div>
      )}

      {/* Pay with */}
      <div className="card mb-4">
        <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">Pay With</p>
        <div className="grid grid-cols-4 gap-2">
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

        {/* Cost display — varies by chain */}
        {payChain === "avax" && (
          <>
            <div className="flex justify-between mt-3 text-sm">
              <span className="text-gray-400">Cost in AVAX</span>
              <span className="font-semibold">{avaxCost.toFixed(4)} AVAX</span>
            </div>
            {usdPrices.avax && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-400">USD equivalent</span>
                <span className="text-gray-300">≈ ${(avaxCost * usdPrices.avax).toFixed(2)} USD</span>
              </div>
            )}
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-400">Rate (live)</span>
              <span className="font-semibold">1 AVAX = {gchPerAvax.toLocaleString()} GCH</span>
            </div>
          </>
        )}

        {(payChain === "usdt" || payChain === "usdc") && (
          <div className="flex justify-between mt-3 text-sm">
            <span className="text-gray-400">Cost in {chain?.label}</span>
            <span className="font-semibold">
              {gchNum.toLocaleString()} {chain?.label}
              <span className="text-gray-400 ml-2 font-normal">· 1 GCH = $1.00 USD</span>
            </span>
          </div>
        )}

        {(payChain === "eth" || payChain === "sol" || payChain === "btc") && (
          <>
            <div className="flex justify-between mt-3 text-sm">
              <span className="text-gray-400">USD value</span>
              <span className="font-semibold">${gchNum.toLocaleString()} USD</span>
            </div>
            {usdPrices[payChain] && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-400">Cost in {chain?.label}</span>
                <span className="text-gray-300">
                  ≈ {(gchNum / usdPrices[payChain]).toFixed(6)} {chain?.label}
                  <span className="text-gray-500 ml-1">
                    @ ${usdPrices[payChain].toLocaleString()}/ea
                  </span>
                </span>
              </div>
            )}
          </>
        )}

        {payChain === "card" && (
          <div className="flex justify-between mt-3 text-sm">
            <span className="text-gray-400">Charge</span>
            <span className="font-semibold">${gchNum.toLocaleString()} USD · 1 GCH = $1.00</span>
          </div>
        )}

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

      {/* WDK info */}
      {payChain !== "avax" && payChain !== "card" && (
        <div className="mb-4 p-3 rounded-xl bg-blue-900/20 border border-blue-700/30 text-xs text-blue-300">
          <strong>Tether WDK:</strong> Your {chain?.label} is automatically bridged
          to AVAX on Fuji and GCH is credited to your wallet.
        </div>
      )}

      {/* Card stub UI */}
      {payChain === "card" && (
        <div className="card mb-4 flex flex-col gap-3">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
            Card Details
          </p>
          <input
            type="text"
            placeholder="Name on card"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-avax-red"
          />
          <input
            type="text"
            placeholder="Card number"
            maxLength={19}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-avax-red"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="MM / YY"
              maxLength={7}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-avax-red"
            />
            <input
              type="text"
              placeholder="CVC"
              maxLength={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-avax-red"
            />
          </div>
          <p className="text-[10px] text-gray-600">
            Payments processed by Stripe · SSL encrypted
          </p>
        </div>
      )}

      {/* Buy button */}
      {!isLoggedIn ? (
        <div className="flex flex-col gap-2">
          <button onClick={connect} className="btn-primary w-full py-3 text-base">
            Connect Wallet
          </button>
          <Link to="/login" className="btn-secondary w-full py-3 text-base text-center">
            Log In to Buy
          </Link>
        </div>
      ) : (
        <button
          onClick={handleBuy}
          disabled={loading || gchNum <= 0}
          className="btn-primary w-full py-3 text-base"
        >
          {loading
            ? "Processing…"
            : payChain === "card"
            ? `Pay $${gchNum.toLocaleString()} USD`
            : `Buy ${gchNum.toLocaleString()} GCH`}
        </button>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400 bg-red-900/20 p-3 rounded-xl">{error}</p>
      )}

      {txHash && (
        <div className="mt-3 p-3 rounded-xl bg-green-900/20 border border-green-700/30 text-xs text-green-400">
          {txHash === "STRIPE-PENDING" ? (
            <p>Card payment initiated — GCH will be credited after payment confirms.</p>
          ) : txHash.startsWith("WDK") ? (
            <>
              <p className="font-bold mb-1">Bridge initiated!</p>
              <p>WDK ref: {txHash}</p>
            </>
          ) : (
            <>
              <p className="font-bold mb-1">Purchase confirmed!</p>
              <a
                href={`https://testnet.snowtrace.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="underline break-all"
              >
                View on Snowtrace ↗
              </a>
            </>
          )}
        </div>
      )}

      <p className="text-center text-xs text-gray-500 mt-6">
        Need test AVAX?{" "}
        <a
          href="https://faucet.avax.network"
          target="_blank"
          rel="noreferrer"
          className="text-avax-red underline"
        >
          faucet.avax.network ↗
        </a>
      </p>
    </div>
  );
}
