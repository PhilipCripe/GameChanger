import { createContext, useContext, useState, useEffect, createElement } from "react";

const AuthCtx = createContext(null);
const TOKEN_KEY = "gc_session_token";

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchMe(token) {
    const t = token ?? localStorage.getItem(TOKEN_KEY);
    if (!t) { setUser(null); setLoading(false); return; }
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        setUser(await res.json());
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      }
    } catch {
      setUser(null);
    }
    setLoading(false);
  }

  useEffect(() => { fetchMe(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function login(email, password) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem(TOKEN_KEY, data.token);
    await fetchMe(data.token);
  }

  async function signup(email, password) {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Signup failed");
    localStorage.setItem(TOKEN_KEY, data.token);
    await fetchMe(data.token);
  }

  async function logout() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  async function linkWallet(address, signer) {
    const token = localStorage.getItem(TOKEN_KEY);
    const message = `Link wallet ${address} to GameChanger account`;
    const signature = await signer.signMessage(message);
    const res = await fetch("/api/auth/link-wallet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ address, signature, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Wallet link failed");
    await fetchMe(token);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  async function refreshUser() {
    return fetchMe();
  }

  const value = { user, loading, login, signup, logout, linkWallet, getToken, refreshUser };
  return createElement(AuthCtx.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
