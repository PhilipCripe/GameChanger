import { useState, useEffect, useCallback } from "react";
import { getContract, getProvider } from "../utils/contract";
import { useWallet } from "./useWallet";

const TOKEN_KEY = "gc_admin_token";

export function useAdmin() {
  const { address, connected } = useWallet();
  const [ownerAddress, setOwnerAddress] = useState(null);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY) || "");

  useEffect(() => {
    getContract(getProvider())
      .owner()
      .then(setOwnerAddress)
      .catch(() => setOwnerAddress(null))
      .finally(() => setOwnerLoading(false));
  }, []);

  const isOwner =
    !!(address && ownerAddress &&
       address.toLowerCase() === ownerAddress.toLowerCase());

  const saveToken = useCallback((t) => {
    localStorage.setItem(TOKEN_KEY, t);
    setTokenState(t);
  }, []);

  const clearToken = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setTokenState("");
  }, []);

  /** Headers for every admin CF Function call */
  const authHeaders = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${token}`,
  };

  return {
    isOwner,
    ownerAddress,
    ownerLoading,
    connected,
    token,
    saveToken,
    clearToken,
    authHeaders,
  };
}
