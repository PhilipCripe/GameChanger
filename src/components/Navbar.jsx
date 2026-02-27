import { Link, useLocation } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useAdmin }  from "../hooks/useAdmin";
import { formatGCH } from "../utils/contract";

export default function Navbar() {
  const { address, gchBalance, connected, loading, connect, wrongNetwork } = useWallet();
  const { isOwner } = useAdmin();
  const loc = useLocation();

  const nav = [
    { to: "/",        label: "Marketplace" },
    { to: "/vote",    label: "Agora Vote"  },
    { to: "/modder",  label: "Modder Hub"  },
    { to: "/buy-gch", label: "Buy GCH"    },
  ];

  function short(addr) {
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-black text-xl tracking-tight shrink-0">
          <span className="w-8 h-8 rounded-lg bg-avax-red flex items-center justify-center text-white text-sm font-black">G</span>
          <span className="hidden sm:inline">Game<span className="text-avax-red">Changer</span></span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                loc.pathname === n.to
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              }`}
            >
              {n.label}
            </Link>
          ))}
          {/* Admin link – only visible to owner */}
          {isOwner && (
            <Link
              to="/admin"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                loc.pathname.startsWith("/admin")
                  ? "bg-avax-red/20 text-avax-red"
                  : "text-gray-600 hover:text-avax-red hover:bg-avax-red/10"
              }`}
            >
              Admin ⚙
            </Link>
          )}
        </div>

        {/* Wallet */}
        <div className="flex items-center gap-3">
          {connected && (
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 text-sm font-semibold text-brand-500">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12z"/>
              </svg>
              {formatGCH(gchBalance)}
            </span>
          )}
          {wrongNetwork && (
            <span className="badge bg-red-900/50 text-red-400">Wrong Network</span>
          )}
          <button
            onClick={connect}
            disabled={loading}
            className="btn-primary text-xs"
          >
            {loading ? "Connecting…" : connected ? short(address) : "Connect Wallet"}
          </button>
        </div>
      </div>
    </nav>
  );
}
