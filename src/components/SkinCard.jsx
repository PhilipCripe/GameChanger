import { useState } from "react";
import { getContract, getSigner, CATEGORY_LABELS } from "../utils/contract";

export default function SkinCard({ listing, connected, onPurchased }) {
  const [loading, setLoading] = useState(false);
  const [txHash,  setTxHash]  = useState(null);
  const [code,    setCode]    = useState(null);
  const [error,   setError]   = useState(null);

  async function handleBuy() {
    if (!connected) { setError("Connect wallet first"); return; }
    setLoading(true);
    setError(null);
    setCode(null);
    try {
      const signer   = await getSigner();
      const contract = getContract(signer);
      const tx       = await contract.purchaseItem(listing.id);
      const receipt  = await tx.wait();
      setTxHash(receipt.hash);

      // Extract redeem code from ItemPurchased event
      const event = receipt.logs
        .map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } })
        .find((l) => l?.name === "ItemPurchased");
      if (event) {
        // Show first 18 chars of the bytes32 hash as a display code
        setCode(event.args.redeemCode.slice(0, 18).toUpperCase());
      }
      onPurchased?.();
    } catch (e) {
      setError(e.reason || e.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  }

  const soldOut = listing.supply > 0 && listing.sold >= listing.supply;

  return (
    <div className="card flex flex-col gap-4 hover:border-gray-700 transition-colors">
      {/* Preview image */}
      <div className="rounded-xl bg-gray-800 h-40 flex items-center justify-center overflow-hidden relative">
        <img
          src={listing.image}
          alt={listing.name}
          className="h-32 w-auto object-contain drop-shadow-lg"
          onError={(e) => { e.target.style.display = "none"; }}
        />
        {soldOut && (
          <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
            <span className="font-black text-red-400 text-sm">SOLD OUT</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-base">{listing.name}</h3>
          <div className="flex gap-1.5">
            <span className="badge bg-gray-800 text-gray-400 text-[10px]">
              {CATEGORY_LABELS[listing.category]}
            </span>
            <span className={`badge bg-gray-800 ${listing.rarityColor}`}>
              {listing.rarity}
            </span>
          </div>
        </div>
        {listing.supply > 0 && (
          <p className="text-xs text-gray-500">
            {listing.supply - listing.sold} / {listing.supply} remaining
          </p>
        )}
        {listing.modder && listing.modder !== "0x0000000000000000000000000000000000000000" && (
          <p className="text-xs text-gray-500 mt-0.5">
            Modder: {listing.modder.slice(0, 6)}…{listing.modder.slice(-4)}{" "}
            <span className="text-green-500">({listing.modderBps / 100}% share)</span>
          </p>
        )}
      </div>

      {/* Price + buy */}
      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="font-black text-lg text-avax-red">{listing.priceGCH} GCH</span>
        <button
          onClick={handleBuy}
          disabled={loading || soldOut || !connected}
          className="btn-primary flex-1"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Buying…
            </span>
          ) : soldOut ? "Sold Out" : "Buy Now"}
        </button>
      </div>

      {/* Feedback */}
      {error && <p className="text-xs text-red-400 bg-red-900/20 p-2 rounded-lg">{error}</p>}
      {txHash && !code && <p className="text-xs text-green-400">Tx confirmed!</p>}
      {code && (
        <div className="bg-brand-900/20 border border-brand-700/40 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Your Redeem Code</p>
          <p className="font-mono font-bold text-brand-400 tracking-widest text-sm break-all">{code}</p>
          <p className="text-xs text-gray-500 mt-1">Save this – it won't appear again!</p>
        </div>
      )}
    </div>
  );
}
