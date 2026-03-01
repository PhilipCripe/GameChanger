import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useWallet } from "../hooks/useWallet";

export default function Login() {
  const navigate         = useNavigate();
  const { login }        = useAuth();
  const { connect, connected } = useWallet();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleWalletLogin() {
    setError(null);
    try {
      await connect();
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-3xl font-black mb-2">Log In</h1>
      <p className="text-gray-400 text-sm mb-8">Welcome back.</p>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-4 mb-4">
        <div>
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-avax-red"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
            Password
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-avax-red"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 p-2 rounded-lg">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Signing in…" : "Log In"}
        </button>
      </form>

      <div className="card flex flex-col gap-3">
        <p className="text-xs text-gray-400 text-center font-semibold uppercase tracking-wider">
          or
        </p>
        <button onClick={handleWalletLogin} className="btn-secondary text-sm">
          {connected ? "Wallet already connected" : "Sign in with Wallet"}
        </button>
      </div>

      <p className="text-center text-sm text-gray-400 mt-4">
        No account yet?{" "}
        <Link to="/signup" className="text-avax-red hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
