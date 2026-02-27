import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { getProvider, getContract, switchToFuji, FUJI_CHAIN_ID } from "../utils/contract";

export function useWallet() {
  const [address,    setAddress]    = useState(null);
  const [chainId,    setChainId]    = useState(null);
  const [gchBalance, setGchBalance] = useState(0n);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  const fetchBalance = useCallback(async (addr) => {
    if (!addr) return;
    try {
      const provider  = getProvider();
      const contract  = getContract(provider);
      const bal       = await contract.getBalance(addr);
      setGchBalance(bal);
    } catch { /* ignore */ }
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!window.ethereum) throw new Error("Please install MetaMask");
      await switchToFuji();
      const provider = getProvider();
      const accounts = await provider.send("eth_requestAccounts", []);
      const network  = await provider.getNetwork();
      setAddress(accounts[0]);
      setChainId(Number(network.chainId));
      await fetchBalance(accounts[0]);
    } catch (e) {
      setError(e.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  }, [fetchBalance]);

  // Listen for account / chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accs) => { setAddress(accs[0] || null); fetchBalance(accs[0]); };
    const onChain    = (cid)  => setChainId(parseInt(cid, 16));
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged",    onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged",    onChain);
    };
  }, [fetchBalance]);

  // Auto-connect if already approved
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((accs) => {
      if (accs[0]) { setAddress(accs[0]); fetchBalance(accs[0]); }
    });
    getProvider().getNetwork().then((n) => setChainId(Number(n.chainId))).catch(() => {});
  }, [fetchBalance]);

  const wrongNetwork = chainId !== null && chainId !== FUJI_CHAIN_ID;

  return {
    address,
    chainId,
    gchBalance,
    connected: !!address,
    wrongNetwork,
    loading,
    error,
    connect,
    refreshBalance: () => fetchBalance(address),
  };
}
