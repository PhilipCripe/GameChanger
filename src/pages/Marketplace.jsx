import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useAuth }   from "../hooks/useAuth";
import SkinCard from "../components/SkinCard";
import { getProvider, getContract, fetchListings, CATEGORY_LABELS } from "../utils/contract";

export default function Marketplace() {
  const { connected, connect, refreshBalance } = useWallet();
  const { user, refreshUser } = useAuth();
  const [listings,    setListings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filterCat,   setFilterCat]   = useState(null);
  const [liveStats,   setLiveStats]   = useState({ activePolls: null, modderPayout: null });

  async function loadListings() {
    setLoading(true);
    try {
      const provider = getProvider();
      const data     = await fetchListings(provider);
      setListings(data);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const provider = getProvider();
      const contract = getContract(provider);

      // Count active polls
      const pollCount = Number(await contract.pollCount());
      let activePolls = 0;
      for (let i = 1; i <= pollCount; i++) {
        const meta = await contract.getPollMeta(i);
        if (meta.active) activePolls++;
      }

      // Sum modder payouts from ModderSharePaid events
      const events = await contract.queryFilter(contract.filters.ModderSharePaid(), 0);
      const modderPayout = events.reduce((sum, e) => sum + Number(e.args.gchAmount), 0);

      setLiveStats({ activePolls, modderPayout });
    } catch { /* contract not deployed yet — silently skip */ }
  }

  useEffect(() => { loadListings(); loadStats(); }, []);

  const categories = [...new Set(listings.map((l) => l.category))];
  const displayed  = filterCat === null
    ? listings
    : listings.filter((l) => l.category === filterCat);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-avax-red/10 border border-avax-red/30 text-avax-red text-xs font-semibold mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-avax-red animate-pulse" />
          LIVE on Avalanche Fuji Testnet
        </div>
        <h1 className="text-4xl md:text-5xl font-black mb-4">
          Game<span className="text-avax-red">Changer</span> Marketplace
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Buy exclusive skins, DLC, and bundles using GCH tokens.
          Pay with USDT, USDC, ETH, SOL, BTC or AVAX — auto-converted via Tether WDK.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          {!connected && !user ? (
            <>
              <button onClick={connect} className="btn-primary px-8 py-3">Connect Wallet</button>
              <Link to="/signup" className="btn-secondary px-8 py-3">Sign Up Free</Link>
            </>
          ) : (
            <Link to="/buy-gch" className="btn-primary px-8 py-3">Buy GCH Tokens</Link>
          )}
          <Link to="/vote" className="btn-secondary px-8 py-3">Vote on Next DLC</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Items Listed",   value: loading ? "…" : listings.length },
          { label: "GCH Rate",       value: "1 GCH = $1 USD" },
          { label: "Active Polls",   value: liveStats.activePolls ?? "…" },
          { label: "Modder Payouts", value: liveStats.modderPayout !== null ? `$${liveStats.modderPayout.toLocaleString()}` : "…" },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterCat(null)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              filterCat === null
                ? "bg-avax-red border-avax-red text-white"
                : "border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                filterCat === cat
                  ? "bg-avax-red border-avax-red text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <h2 className="text-xl font-bold mb-6">
        {filterCat !== null ? CATEGORY_LABELS[filterCat] + "s" : "All Items"}
      </h2>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-72 bg-gray-800/50" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayed.map((listing) => (
            <SkinCard
              key={listing.id}
              listing={listing}
              connected={connected}
              user={user}
              onPurchased={() => { refreshBalance(); refreshUser(); loadListings(); }}
            />
          ))}
          {/* Coming soon slot */}
          <div className="card flex flex-col items-center justify-center gap-3 min-h-[280px] border-dashed opacity-40">
            <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center text-xl">+</div>
            <p className="font-semibold text-gray-400 text-sm">More items coming soon</p>
            <p className="text-xs text-gray-500">Vote in Agora to decide next!</p>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="mt-16">
        <h2 className="text-xl font-bold mb-6 text-center">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { n: "1", title: "Get Test AVAX",   desc: "Grab free AVAX from faucet.avax.network" },
            { n: "2", title: "Buy GCH Tokens",  desc: "1 GCH = $1 USD — pay with AVAX, card, or crypto" },
            { n: "3", title: "Purchase Item",   desc: "Spend GCH, receive on-chain redeem code" },
            { n: "4", title: "Redeem In-Game",  desc: "Enter code in game to unlock your item" },
          ].map((s) => (
            <div key={s.n} className="card text-center">
              <div className="w-8 h-8 rounded-full bg-avax-red/20 text-avax-red font-black text-sm flex items-center justify-center mx-auto mb-3">
                {s.n}
              </div>
              <p className="font-semibold text-sm mb-1">{s.title}</p>
              <p className="text-xs text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
