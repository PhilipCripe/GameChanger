import { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { getContract, getSigner, getProvider, fetchPolls, formatGCH } from "../utils/contract";

export default function Vote() {
  const { address, connected, gchBalance, connect, refreshBalance } = useWallet();
  const [polls,    setPolls]    = useState([]);
  const [loading,  setLoading]  = useState(true);

  async function loadPolls() {
    try {
      setPolls(await fetchPolls(getProvider()));
    } catch { setPolls([]); }
    finally  { setLoading(false); }
  }

  useEffect(() => {
    loadPolls();
    const id = setInterval(loadPolls, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <span className="badge bg-purple-900/40 text-purple-400 mb-4">Agora</span>
        <h1 className="text-3xl font-black mb-2">Community Votes</h1>
        <p className="text-gray-400 text-sm">
          Spend GCH to shape the game. New polls appear here automatically as they are created.
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => <div key={i} className="card animate-pulse h-56 bg-gray-800/50" />)}
        </div>
      ) : polls.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">No active polls right now.</div>
      ) : (
        <div className="space-y-8">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              address={address}
              connected={connected}
              gchBalance={gchBalance}
              connect={connect}
              onVoted={() => { refreshBalance(); loadPolls(); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single poll component ────────────────────────────────────────────────────
function PollCard({ poll, address, connected, gchBalance, connect, onVoted }) {
  const [selected, setSelected] = useState(null);
  const [voted,    setVoted]    = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [txHash,   setTxHash]   = useState(null);
  const [error,    setError]    = useState(null);

  const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0) || 1;

  function pct(votes) {
    return Math.round((votes / totalVotes) * 100);
  }

  async function handleVote() {
    if (!connected) { connect(); return; }
    if (selected === null) { setError("Pick an option"); return; }
    setLoading(true);
    setError(null);
    try {
      const signer   = await getSigner();
      const contract = getContract(signer);
      const tx       = await contract.castVote(poll.id, selected);
      const receipt  = await tx.wait();
      setTxHash(receipt.hash);
      setVoted(true);
      onVoted?.();
    } catch (e) {
      setError(e.reason || e.message || "Vote failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="font-bold text-lg">{poll.question}</h2>
          {poll.endsAt > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Ends {new Date(poll.endsAt * 1000).toLocaleDateString()}
            </p>
          )}
        </div>
        <span className="badge bg-avax-red/20 text-avax-red shrink-0">
          {poll.costGCH > 0 ? `${poll.costGCH} GCH` : "Free"}
        </span>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {poll.options.map((opt) => (
          <button
            key={opt.index}
            onClick={() => !voted && setSelected(opt.index)}
            disabled={voted}
            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
              selected === opt.index && !voted
                ? "border-avax-red bg-avax-red/10"
                : voted
                ? "border-gray-800 cursor-default"
                : "border-gray-800 hover:border-gray-600"
            }`}
          >
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-semibold">{opt.label}</span>
              <span className="text-gray-400 font-mono">{pct(opt.votes)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-avax-red transition-all duration-500"
                style={{ width: `${pct(opt.votes)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {opt.votes.toLocaleString()} vote{opt.votes !== 1 ? "s" : ""}
            </p>
          </button>
        ))}
      </div>

      {!voted ? (
        <button
          onClick={handleVote}
          disabled={loading || (selected === null && connected)}
          className="btn-primary w-full"
        >
          {loading ? "Casting vote…"
            : !connected        ? "Connect Wallet to Vote"
            : selected === null ? "Select an option above"
            : poll.costGCH > 0  ? `Vote (costs ${poll.costGCH} GCH)`
            : "Cast Free Vote"}
        </button>
      ) : (
        <div className="p-3 rounded-xl bg-green-900/20 border border-green-700/30 text-xs text-green-400 text-center">
          Vote recorded!{" "}
          {txHash && (
            <a href={`https://testnet.snowtrace.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline">
              View on Snowtrace ↗
            </a>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-400 bg-red-900/20 p-2 rounded-lg">{error}</p>}
    </div>
  );
}
