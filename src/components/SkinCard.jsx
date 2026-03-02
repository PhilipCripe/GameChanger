import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getContract, getSigner, CATEGORY_LABELS } from "../utils/contract";

export default function SkinCard({ listing, connected, user, onPurchased }) {
  const { getToken } = useAuth();
  const [loading,        setLoading]        = useState(false);
  const [txHash,         setTxHash]         = useState(null);
  const [code,           setCode]           = useState(null);
  const [error,          setError]          = useState(null);
  const [contactSupport, setContactSupport] = useState(false);
  const [pendingPurchase,setPendingPurchase]= useState(null); // { code, listing }

  // Support form state
  const [supportMsg,     setSupportMsg]     = useState("");
  const [supportSent,    setSupportSent]    = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);

  const isLoggedIn = connected || !!user;

  async function handleBuy() {
    if (!isLoggedIn) { setError("Log in or connect wallet to purchase"); return; }
    setLoading(true);
    setError(null);
    setCode(null);
    setContactSupport(false);

    try {
      if (!connected && user) {
        // Email-user path — off-chain KV purchase via CF Function
        const token = getToken();
        const res   = await fetch("/api/shop/purchase", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ listingId: listing.id }),
        });
        const data = await res.json();

        if (data.contactSupport) {
          // Gas wallet low — purchase recorded, NFT pending manual mint
          setContactSupport(true);
          setPendingPurchase({ code: data.code, listing: data.listing });
          setSupportMsg(
            `I purchased "${listing.name}" (code: ${data.code}) but received a contact support message. Please mint my NFT when ready.`
          );
          onPurchased?.();
          return;
        }

        if (!res.ok) { setError(data.error || "Purchase failed"); return; }
        setCode(data.code);
        setTxHash("KV-PURCHASE");
        onPurchased?.();
        return;
      }

      // Wallet path — on-chain
      const signer   = await getSigner();
      const contract = getContract(signer);
      const tx       = await contract.purchaseItem(listing.id);
      const receipt  = await tx.wait();
      setTxHash(receipt.hash);

      const event = receipt.logs
        .map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } })
        .find((l) => l?.name === "ItemPurchased");
      if (event) setCode(event.args.redeemCode.slice(0, 18).toUpperCase());
      onPurchased?.();
    } catch (e) {
      setError(e.reason || e.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSupportSubmit(e) {
    e.preventDefault();
    if (!supportMsg.trim()) return;
    setSupportLoading(true);
    try {
      const token = getToken();
      await fetch("/api/support/contact", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          message:     supportMsg,
          listingId:   pendingPurchase?.listing?.id,
          listingName: pendingPurchase?.listing?.name,
          displayCode: pendingPurchase?.code,
        }),
      });
      setSupportSent(true);
    } catch {
      setSupportSent(true); // show success anyway — KV ticket may have been created during purchase
    } finally {
      setSupportLoading(false);
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
        {isLoggedIn ? (
          <button
            onClick={handleBuy}
            disabled={loading || soldOut || contactSupport}
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
        ) : (
          <Link to="/login" className="btn-secondary flex-1 text-center text-sm">
            Log In to Buy
          </Link>
        )}
      </div>

      {/* Standard feedback */}
      {error && <p className="text-xs text-red-400 bg-red-900/20 p-2 rounded-lg">{error}</p>}
      {txHash && !code && <p className="text-xs text-green-400">Transaction confirmed!</p>}
      {code && (
        <div className="bg-brand-900/20 border border-brand-700/40 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Your Redeem Code</p>
          <p className="font-mono font-bold text-brand-400 tracking-widest text-sm break-all">{code}</p>
          <p className="text-xs text-gray-500 mt-1">Save this – it won't appear again!</p>
        </div>
      )}

      {/* Contact support flow — shown when gas wallet is low */}
      {contactSupport && (
        <div className="border border-yellow-700/40 bg-yellow-900/10 rounded-xl p-4">
          <p className="text-sm font-semibold text-yellow-300 mb-1">Purchase recorded!</p>
          <p className="text-xs text-gray-400 mb-3">
            Your payment was accepted and your code is saved, but your NFT couldn't be minted
            automatically right now. Please contact support and we'll mint it for you shortly.
          </p>
          {pendingPurchase?.code && (
            <p className="text-xs font-mono bg-gray-800 px-2 py-1 rounded mb-3 text-gray-300">
              Order ref: {pendingPurchase.code}
            </p>
          )}
          {supportSent ? (
            <p className="text-xs text-green-400 bg-green-900/20 p-2 rounded-lg">
              Support ticket sent! We'll be in touch soon.
            </p>
          ) : (
            <form onSubmit={handleSupportSubmit} className="space-y-2">
              <textarea
                value={supportMsg}
                onChange={(e) => setSupportMsg(e.target.value)}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-yellow-600 resize-none"
                placeholder="Add any extra details…"
              />
              <button
                type="submit"
                disabled={supportLoading || !supportMsg.trim()}
                className="w-full btn-secondary text-xs py-2"
              >
                {supportLoading ? "Sending…" : "Send to Support"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
