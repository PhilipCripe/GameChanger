import { useState, useEffect } from "react";
import { getContract, getSigner, getProvider, fetchAllListings, CATEGORY_LABELS, Category } from "../../utils/contract";
import { ethers } from "ethers";

const ZERO = ethers.ZeroAddress;

const EMPTY_FORM = {
  name: "", sku: "", category: "0", priceGCH: "",
  supply: "0", modder: "", modderBps: "0", expiresAt: "",
};

export default function Listings() {
  const [listings,  setListings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState(null); // listing id or null
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState(null);

  async function load() {
    setLoading(true);
    try { setListings(await fetchAllListings(getProvider())); }
    catch { setListings([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setMsg(null);
  }

  function openEdit(l) {
    setEditing(l.id);
    setForm({
      name:      l.name,
      sku:       l.sku,
      category:  String(l.category),
      priceGCH:  String(l.priceGCH),
      supply:    String(l.supply),
      modder:    l.modder === ZERO ? "" : l.modder,
      modderBps: String(l.modderBps),
      expiresAt: l.expiresAt > 0 ? new Date(l.expiresAt * 1000).toISOString().slice(0, 16) : "",
    });
    setShowForm(true);
    setMsg(null);
  }

  function field(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const expiresAtUnix = form.expiresAt
    ? Math.floor(new Date(form.expiresAt).getTime() / 1000)
    : 0;

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const signer   = await getSigner();
      const contract = getContract(signer);
      const modder   = form.modder && ethers.isAddress(form.modder) ? form.modder : ZERO;

      let tx;
      if (editing === null) {
        tx = await contract.createListing(
          form.name, form.sku.toUpperCase(), Number(form.category),
          Number(form.priceGCH), Number(form.supply),
          modder, Number(form.modderBps), expiresAtUnix
        );
      } else {
        tx = await contract.updateListing(
          editing, Number(form.priceGCH), Number(form.supply),
          modder, Number(form.modderBps), expiresAtUnix, true
        );
      }
      await tx.wait();
      setMsg({ ok: true, text: editing ? "Listing updated." : "Listing created." });
      setShowForm(false);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e.reason || e.message || "Transaction failed" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id) {
    if (!confirm("Deactivate this listing?")) return;
    try {
      const signer   = await getSigner();
      const contract = getContract(signer);
      await (await contract.deactivateListing(id)).wait();
      await load();
    } catch (e) {
      alert(e.reason || e.message);
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">Listings</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              All items in the marketplace. Add new skins, DLC, or bundles without redeploying.
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary">+ New Listing</button>
        </div>

        {msg && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${msg.ok ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>
            {msg.text}
          </div>
        )}

        {/* Create / Edit form */}
        {showForm && (
          <div className="card mb-6 border-avax-red/30">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">{editing ? `Edit Listing #${editing}` : "New Listing"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name" disabled={!!editing}>
                <input value={form.name} onChange={(e) => field("name", e.target.value)} disabled={!!editing} className="input" placeholder="F-22 Raptor" />
              </Field>
              <Field label="SKU (uppercase, no spaces)" disabled={!!editing}>
                <input value={form.sku} onChange={(e) => field("sku", e.target.value.toUpperCase().replace(/\s/g, "_"))} disabled={!!editing} className="input font-mono" placeholder="F22_RAPTOR" />
              </Field>
              <Field label="Category" disabled={!!editing}>
                <select value={form.category} onChange={(e) => field("category", e.target.value)} disabled={!!editing} className="input">
                  {CATEGORY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
                </select>
              </Field>
              <Field label="Price (GCH)">
                <input type="number" min="1" value={form.priceGCH} onChange={(e) => field("priceGCH", e.target.value)} className="input" placeholder="300" />
              </Field>
              <Field label="Supply (0 = unlimited)">
                <input type="number" min="0" value={form.supply} onChange={(e) => field("supply", e.target.value)} className="input" placeholder="0" />
              </Field>
              <Field label="Expires At (optional)">
                <input type="datetime-local" value={form.expiresAt} onChange={(e) => field("expiresAt", e.target.value)} className="input" />
              </Field>
              <Field label="Modder Address (optional)">
                <input value={form.modder} onChange={(e) => field("modder", e.target.value)} className="input font-mono text-xs" placeholder="0x…" />
              </Field>
              <Field label="Modder Share (basis points, e.g. 3000 = 30%)">
                <input type="number" min="0" max="9000" value={form.modderBps} onChange={(e) => field("modderBps", e.target.value)} className="input" placeholder="0" />
              </Field>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving || !form.name || !form.sku || !form.priceGCH} className="btn-primary">
                {saving ? "Saving…" : editing ? "Update Listing" : "Create Listing"}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="card h-12 animate-pulse bg-gray-800/50" />)}
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800">
                <tr className="text-left text-xs text-gray-400">
                  {["ID", "Name", "SKU", "Category", "Price", "Supply", "Sold", "Modder %", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {listings.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">No listings yet.</td></tr>
                )}
                {listings.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-400 font-mono">{l.id}</td>
                    <td className="px-4 py-3 font-medium">{l.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{l.sku}</td>
                    <td className="px-4 py-3">{CATEGORY_LABELS[l.category]}</td>
                    <td className="px-4 py-3 font-bold text-avax-red">{l.priceGCH.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-400">{l.supply === 0 ? "∞" : l.supply}</td>
                    <td className="px-4 py-3">{l.sold}</td>
                    <td className="px-4 py-3 text-gray-400">{l.modderBps > 0 ? `${l.modderBps / 100}%` : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${l.active ? "bg-green-900/30 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                        {l.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(l)} className="text-xs text-gray-400 hover:text-white transition-colors">Edit</button>
                        {l.active && (
                          <button onClick={() => handleDeactivate(l.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Deactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, disabled }) {
  return (
    <div>
      <label className={`block text-xs font-semibold mb-1.5 ${disabled ? "text-gray-600" : "text-gray-400"}`}>{label}</label>
      {children}
    </div>
  );
}
