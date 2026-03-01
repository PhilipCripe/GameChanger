import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useWallet } from "../hooks/useWallet";

export default function Signup() {
  const navigate              = useNavigate();
  const { signup }            = useAuth();
  const { connect, connected, address } = useWallet();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    setError(null);
    try {
      await signup(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-3xl font-black mb-2">Create Account</h1>
      <p className="text-gray-400 text-sm mb-8">
        No crypto wallet required to get started.
      </p>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
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
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-avax-red"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-avax-red"
          />
        </div>

        {/* Optional wallet connect */}
        {connected ? (
          <p className="text-xs text-green-400 bg-green-900/20 px-3 py-2 rounded-xl">
            Wallet linked: {address.slice(0, 6)}…{address.slice(-4)}
          </p>
        ) : (
          <button
            type="button"
            onClick={connect}
            className="btn-secondary text-sm"
          >
            Connect Wallet (optional)
          </button>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 p-2 rounded-lg">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creating account…" : "Sign Up"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-400 mt-4">
        Already have an account?{" "}
        <Link to="/login" className="text-avax-red hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
