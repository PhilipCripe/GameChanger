import { useState, useRef, useCallback } from "react";
import { useAdmin } from "../../hooks/useAdmin";
import { getProvider, fetchAllListings } from "../../utils/contract";
import { useEffect } from "react";

const SKIN_TYPES    = ["image/svg+xml", "image/png", "image/webp", "image/jpeg"];
const CONTENT_TYPES = []; // any file type accepted

export default function Uploads() {
  const { authHeaders, token } = useAdmin();
  const [tab,      setTab]      = useState("skin");   // "skin" | "content"
  const [listings, setListings] = useState([]);
  const [sku,      setSku]      = useState("");
  const [listingId,setListingId]= useState("");
  const [desc,     setDesc]     = useState("");
  const [file,     setFile]     = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading,setUploading]= useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);
  const [history,  setHistory]  = useState([]);
  const fileRef = useRef();

  useEffect(() => {
    fetchAllListings(getProvider()).then(setListings).catch(() => {});
  }, []);

  function handleFileSelect(f) {
    if (!f) return;
    const isSkin = tab === "skin";
    if (isSkin && !SKIN_TYPES.includes(f.type)) {
      setError("Skins must be SVG, PNG, WebP, or JPEG."); return;
    }
    setFile(f);
    setError(null);
    setResult(null);
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFileSelect(e.dataTransfer.files[0]);
  }, [tab]);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file",      file);
      fd.append("type",      tab);
      fd.append("sku",       tab === "skin" ? sku.toUpperCase() : (listingId || "CONTENT"));
      fd.append("listingId", listingId);
      fd.append("desc",      desc);

      const res  = await fetch("/api/admin/upload", {
        method:  "POST",
        headers: { "Authorization": authHeaders["Authorization"] }, // no Content-Type – let browser set boundary
        body:    fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setResult(data);
      setHistory((h) => [{ ...data, name: file.name, type: tab, ts: Date.now() }, ...h]);
      setFile(null); setPreview(null); setSku(""); setDesc(""); setListingId("");
    } catch (e) {
      setError(e.message);
    } finally { setUploading(false); }
  }

  function resetFile() {
    setFile(null); setPreview(null); setError(null); setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black">Uploads</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Upload skin images and unlocked content files. Stored in Cloudflare R2 (or KV fallback).
          </p>
        </div>

        {!token && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-900/20 border border-yellow-700/30 text-sm text-yellow-300">
            Save your <strong>ADMIN_TOKEN</strong> on the Dashboard page to enable uploads.
          </div>
        )}

        {/* Tab selector */}
        <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {[
            { id: "skin",    label: "Skin Images" },
            { id: "content", label: "Unlocked Content" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); resetFile(); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === t.id ? "bg-avax-red text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="card mb-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !file && fileRef.current?.click()}
            className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center p-8 mb-5 ${
              dragging ? "border-avax-red bg-avax-red/5" : "border-gray-700 hover:border-gray-500"
            } ${file ? "cursor-default" : ""}`}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept={tab === "skin" ? SKIN_TYPES.join(",") : undefined}
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />

            {file ? (
              <div className="text-center w-full">
                {preview && (
                  <img src={preview} alt="preview" className="h-32 mx-auto mb-4 object-contain rounded-lg" />
                )}
                {!preview && (
                  <div className="w-16 h-16 rounded-xl bg-gray-800 flex items-center justify-center mx-auto mb-4 text-2xl">📄</div>
                )}
                <p className="font-semibold text-sm">{file.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB · {file.type || "unknown"}</p>
                <button onClick={(e) => { e.stopPropagation(); resetFile(); }} className="mt-3 text-xs text-red-400 hover:text-red-300">
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mb-4 text-2xl">
                  {tab === "skin" ? "🖼" : "📦"}
                </div>
                <p className="font-semibold mb-1">Drop file here or click to browse</p>
                <p className="text-xs text-gray-500">
                  {tab === "skin"
                    ? "SVG, PNG, WebP, JPEG — recommended 512×512px"
                    : "Any file type — ZIP, PDF, GLB, etc."}
                </p>
              </>
            )}
          </div>

          {/* Metadata */}
          {tab === "skin" ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1.5">Associated Listing SKU</label>
                <select value={listingId} onChange={(e) => { setListingId(e.target.value); setSku(listings.find(l => String(l.id) === e.target.value)?.sku || ""); }} className="input">
                  <option value="">— Select listing or enter SKU manually —</option>
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>{l.sku} · {l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1.5">SKU Override (if not listed)</label>
                <input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} className="input font-mono" placeholder="LEOPARD2_A7" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1.5">Link to Listing</label>
                <select value={listingId} onChange={(e) => setListingId(e.target.value)} className="input">
                  <option value="">— Select listing —</option>
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>{l.sku} · {l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1.5">Description</label>
                <input value={desc} onChange={(e) => setDesc(e.target.value)} className="input" placeholder="What does this unlock? e.g. 'Bayraktar cockpit audio pack'" />
              </div>
            </div>
          )}

          {error  && <p className="mt-4 text-sm text-red-400 bg-red-900/20 p-3 rounded-xl">{error}</p>}
          {result && (
            <div className="mt-4 p-3 rounded-xl bg-green-900/20 border border-green-700/30 text-xs text-green-400">
              <p className="font-bold mb-1">Uploaded successfully!</p>
              <p className="font-mono break-all">{result.url}</p>
              {result.key && <p className="text-green-600 mt-0.5">Key: {result.key}</p>}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading || !token}
            className="btn-primary mt-5 w-full"
          >
            {uploading ? "Uploading…" : `Upload ${tab === "skin" ? "Skin Image" : "Content File"}`}
          </button>
        </div>

        {/* Storage info */}
        <div className="p-4 rounded-xl bg-blue-900/20 border border-blue-700/30 text-xs text-blue-300 mb-6">
          <p className="font-bold mb-1">Storage backend</p>
          <p>
            Files are stored in <strong>Cloudflare R2</strong> if an <code className="bg-blue-900/40 px-1 rounded">ASSETS_BUCKET</code> binding is configured
            in <code className="bg-blue-900/40 px-1 rounded">wrangler.toml</code>, otherwise in <strong>KV</strong> as base64
            (suitable for images ≤ 512KB). Run{" "}
            <code className="bg-blue-900/40 px-1 rounded">wrangler r2 bucket create gamechanger-assets</code> to enable R2.
          </p>
        </div>

        {/* Upload history */}
        {history.length > 0 && (
          <div className="card">
            <h2 className="font-bold mb-4 text-sm text-gray-400 uppercase tracking-wider">Session History</h2>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium">{h.name}</p>
                    <p className="text-xs text-gray-500">{h.type} · {new Date(h.ts).toLocaleTimeString()}</p>
                  </div>
                  <a href={h.url} target="_blank" rel="noreferrer" className="text-xs text-avax-red hover:underline shrink-0">
                    View ↗
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
