import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import { useState } from "react";
import { useAdmin } from "../../hooks/useAdmin";
import { useWallet } from "../../hooks/useWallet";

// ─── Icon primitives ─────────────────────────────────────────────────────────
const Icon = ({ d, className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const Icons = {
  dashboard: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  listings:  "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  polls:     "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  modders:   "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  gameapi:   "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  uploads:   "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12",
  back:      "M10 19l-7-7m0 0l7-7m-7 7h18",
  menu:      "M4 6h16M4 12h16M4 18h16",
  lock:      "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
};

const NAV = [
  { to: "dashboard", label: "Dashboard",  icon: "dashboard" },
  { to: "listings",  label: "Listings",   icon: "listings"  },
  { to: "polls",     label: "Polls",      icon: "polls"     },
  { to: "modders",   label: "Modders",    icon: "modders"   },
  { to: "game-api",  label: "Game API",   icon: "gameapi"   },
  { to: "uploads",   label: "Uploads",    icon: "uploads"   },
];

// ─── States before admin panel is shown ──────────────────────────────────────
function Gate({ children }) {
  const { isOwner, ownerLoading, connected } = useAdmin();
  const { connect, loading } = useWallet();

  if (ownerLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          Verifying ownership…
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="card text-center max-w-sm w-full mx-4">
          <Icon d={Icons.lock} className="w-10 h-10 mx-auto mb-4 text-avax-red" />
          <h2 className="font-black text-xl mb-2">Admin Access</h2>
          <p className="text-gray-400 text-sm mb-6">Connect the contract owner wallet to continue.</p>
          <button onClick={connect} disabled={loading} className="btn-primary w-full">
            {loading ? "Connecting…" : "Connect Wallet"}
          </button>
          <Link to="/" className="block mt-4 text-xs text-gray-500 hover:text-gray-300">← Back to Marketplace</Link>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="card text-center max-w-sm w-full mx-4">
          <Icon d={Icons.lock} className="w-10 h-10 mx-auto mb-4 text-red-400" />
          <h2 className="font-black text-xl mb-2 text-red-400">Not Authorised</h2>
          <p className="text-gray-400 text-sm mb-6">This wallet is not the contract owner.</p>
          <Link to="/" className="btn-secondary">← Back to Marketplace</Link>
        </div>
      </div>
    );
  }

  return children;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ collapsed, setCollapsed }) {
  const loc = useLocation();
  const seg = loc.pathname.split("/").pop();

  return (
    <aside className={`flex flex-col border-r border-gray-800 bg-gray-900 transition-all duration-200 ${collapsed ? "w-16" : "w-56"}`}>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-gray-800 gap-3 shrink-0">
        <span className="w-7 h-7 rounded-md bg-avax-red flex items-center justify-center text-white text-xs font-black shrink-0">G</span>
        {!collapsed && <span className="font-black text-sm tracking-tight">Admin Panel</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = seg === item.to || (seg === "admin" && item.to === "dashboard");
          return (
            <Link
              key={item.to}
              to={`/admin/${item.to}`}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-avax-red/15 text-avax-red"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <Icon d={Icons[item.icon]} className="w-4 h-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-800 p-2 space-y-1">
        <Link
          to="/"
          title={collapsed ? "Marketplace" : undefined}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <Icon d={Icons.back} className="w-4 h-4 shrink-0" />
          {!collapsed && "Marketplace"}
        </Link>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <Icon d={Icons.menu} className="w-4 h-4 shrink-0" />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}

// ─── Layout root ─────────────────────────────────────────────────────────────
export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const loc = useLocation();

  // /admin → /admin/dashboard
  if (loc.pathname === "/admin" || loc.pathname === "/admin/") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <Gate>
      <div className="flex h-screen overflow-hidden bg-gray-950">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </div>
      </div>
    </Gate>
  );
}
