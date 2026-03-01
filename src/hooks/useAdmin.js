import { useState, useEffect, useCallback } from "react";
import { getContract, getProvider } from "../utils/contract";
import { useWallet } from "./useWallet";

const TOKEN_KEY = "gc_admin_token";

export function useAdmin() {
  const { address, connected } = useWallet();
  const [ownerAddress,  setOwnerAddress]  = useState(null);
  const [token,         setTokenState]    = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [loginError,    setLoginError]    = useState(null);
  const [loginLoading,  setLoginLoading]  = useState(false);

  // Still fetch owner for the Navbar admin-link visibility
  useEffect(() => {
    getContract(getProvider())
      .owner()
      .then(setOwnerAddress)
      .catch(() => setOwnerAddress(null));
  }, []);

  const isOwner = !!(
    address && ownerAddress &&
    address.toLowerCase() === ownerAddress.toLowerCase()
  );

  const isAuthenticated = !!token;

  const login = useCallback(async (username, password) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res  = await fetch("/api/admin/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Invalid credentials");
        return false;
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      setTokenState(data.token);
      return true;
    } catch {
      setLoginError("Connection error — check your network");
      return false;
    } finally {
      setLoginLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setTokenState("");
  }, []);

  // Legacy helpers kept for backward compat with other admin pages
  const saveToken  = useCallback((t) => { localStorage.setItem(TOKEN_KEY, t); setTokenState(t); }, []);
  const clearToken = useCallback(() => { localStorage.removeItem(TOKEN_KEY); setTokenState(""); }, []);

  const authHeaders = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${token}`,
  };

  return {
    isOwner,
    isAuthenticated,
    ownerAddress,
    connected,
    token,
    login,
    logout,
    loginError,
    loginLoading,
    saveToken,
    clearToken,
    authHeaders,
  };
}
