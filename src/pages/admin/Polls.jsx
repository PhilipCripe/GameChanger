import { useState, useEffect } from "react";
import { getContract, getSigner, getProvider, fetchAllPolls } from "../../utils/contract";

export default function Polls() {
  const [polls,    setPolls]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState(null);

  const [question, setQuestion] = useState("");
  const [options,  setOptions]  = useState(["", ""]);
  const [costGCH,  setCostGCH]  = useState("50");
  const [endsAt,   setEndsAt]   = useState("");

  async function load() {
    setLoading(true);
    try { setPolls(await fetchAllPolls(getProvider())); }
    catch { setPolls([]); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function addOption()     { if (options.length < 8) setOptions([...options, ""]); }
  function removeOption(i) { if (options.length > 2) setOptions(options.filter((_, j) => j !== i)); }
  function setOption(i, v) { setOptions(options.map((o, j) => j === i ? v : o)); }

  async function handleCreate() {
    const valid = options.filter((o) => o.trim());
    if (!question.trim() || valid.length < 2) return;
    setSaving(true);
    setMsg(null);
    try {
      const signer   = await getSigner();
      const contract = getContract(signer);
      const endsUnix = endsAt ? Math.floor(new Date(endsAt).getTime() / 1000) : 0;
      const tx = await contract.createPoll(question.trim(), valid, Number(costGCH), endsUnix);
      await tx.wait();
      setMsg({ ok: true, text: "Poll created." });
      setShowForm(false);
      setQuestion(""); setOptions(["", ""]); setCostGCH("50"); setEndsAt("");
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e.reason || e.message || "Failed" });
    } finally { setSaving(false); }
  }

  async function handleClose(pollId) {
    if (!confirm("Close this poll? Votes will stop being accepted.")) return;
    try {
      const signer   = await getSigner();
      const contract = getContract(signer);
      await (await contract.closePoll(pollId)).wait();
      await load();
    } catch (e) { alert(e.reason || e.message); }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">Polls</h1>
            <p className="text-gray-400 text-sm mt-0.5">Create community votes with any number of options.</p>
          </div>
          <button onClick={() => { setShowForm(true); setMsg(null); }} className="btn-primary">+ New Poll</button>
        </div>

        {msg && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${msg.ok ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>
            {msg.text}
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="card mb-6 border-avax-red/30">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">New Poll</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1.5">Question</label>
                <input value={question} onChange={(e) => setQuestion(e.target.value)} className="input" placeholder="Which tank should we add next?" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">GCH Cost per Vote</label>
                  <input type="number" min="0" value={costGCH} onChange={(e) => setCostGCH(e.target.value)} className="input" placeholder="50" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">Ends At (optional)</label>
                  <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="input" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-gray-400 font-semibold">Options (min 2, max 8)</label>
                  <button onClick={addOption} disabled={options.length >= 8} className="text-xs text-avax-red hover:text-red-400 disabled:opacity-40">+ Add option</button>
                </div>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="text-xs text-gray-600 w-5 text-right">{i + 1}.</span>
                      <input
                        value={opt}
                        onChange={(e) => setOption(i, e.target.value)}
                        className="input flex-1"
                        placeholder={`Option ${i + 1}`}
                      />
                      {options.length > 2 && (
                        <button onClick={() => removeOption(i)} className="text-gray-600 hover:text-red-400 text-sm leading-none px-1">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleCreate}
                disabled={saving || !question.trim() || options.filter(o => o.trim()).length < 2}
                className="btn-primary"
              >
                {saving ? "Creating…" : "Create Poll"}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {/* Poll list */}
        {loading ? (
          <div className="space-y-3">
            {[1,2].map(i => <div key={i} className="card h-32 animate-pulse bg-gray-800/50" />)}
          </div>
        ) : polls.length === 0 ? (
          <div className="card text-center py-10 text-gray-500">No polls yet.</div>
        ) : (
          <div className="space-y-4">
            {polls.map((poll) => {
              const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
              return (
                <div key={poll.id} className="card">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-gray-500">#{poll.id}</span>
                        <span className={`badge ${poll.active ? "bg-green-900/30 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                          {poll.active ? "Active" : "Closed"}
                        </span>
                        {poll.costGCH > 0 && <span className="badge bg-avax-red/20 text-avax-red">{poll.costGCH} GCH</span>}
                      </div>
                      <h3 className="font-bold">{poll.question}</h3>
                      {poll.endsAt > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">Ends {new Date(poll.endsAt * 1000).toLocaleString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400">{totalVotes} votes</span>
                      {poll.active && (
                        <button onClick={() => handleClose(poll.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                          Close Poll
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {poll.options.map((opt) => {
                      const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                      return (
                        <div key={opt.index}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-300">{opt.label}</span>
                            <span className="text-gray-400">{opt.votes} · {pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                            <div className="h-full rounded-full bg-avax-red transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
