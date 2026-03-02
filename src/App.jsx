import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Navbar          from "./components/Navbar";
import Marketplace     from "./pages/Marketplace";
import BuyGCH          from "./pages/BuyGCH";
import Vote            from "./pages/Vote";
import ModderDashboard from "./pages/ModderDashboard";
import Login           from "./pages/Login";
import Signup          from "./pages/Signup";
import Profile         from "./pages/Profile";

// Admin
import AdminLayout    from "./pages/admin/AdminLayout";
import Dashboard      from "./pages/admin/Dashboard";
import Listings       from "./pages/admin/Listings";
import Polls          from "./pages/admin/Polls";
import Modders        from "./pages/admin/Modders";
import Users          from "./pages/admin/Users";
import GameAPI        from "./pages/admin/GameAPI";
import Uploads        from "./pages/admin/Uploads";
import Support        from "./pages/admin/Support";

// ─── Public layout ────────────────────────────────────────────────────────────
function PublicLayout() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/"        element={<Marketplace />} />
            <Route path="/buy-gch" element={<BuyGCH />} />
            <Route path="/vote"    element={<Vote />} />
            <Route path="/modder"  element={<ModderDashboard />} />
            <Route path="/login"   element={<Login />} />
            <Route path="/signup"  element={<Signup />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*"        element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="border-t border-gray-800 py-6 text-center text-xs text-gray-500">
          <p>
            GameChanger Marketplace · Avalanche Fuji Testnet ·{" "}
            <a href="https://testnet.snowtrace.io" target="_blank" rel="noreferrer" className="text-avax-red hover:underline">Snowtrace</a>
            {" "}·{" "}
            <a href="https://faucet.avax.network" target="_blank" rel="noreferrer" className="text-avax-red hover:underline">Get Test AVAX</a>
          </p>
          <p className="mt-1">Powered by Cloudflare Pages · $0 hosting forever</p>
        </footer>
      </div>
    </AuthProvider>
  );
}

// ─── App root ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      {/* Admin – full-screen, own layout, own auth */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index                  element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"       element={<Dashboard />} />
        <Route path="listings"        element={<Listings />} />
        <Route path="polls"           element={<Polls />} />
        <Route path="modders"         element={<Modders />} />
        <Route path="users"           element={<Users />} />
        <Route path="game-api"        element={<GameAPI />} />
        <Route path="uploads"         element={<Uploads />} />
        <Route path="support"         element={<Support />} />
      </Route>

      {/* Public site */}
      <Route path="/*" element={<PublicLayout />} />
    </Routes>
  );
}
