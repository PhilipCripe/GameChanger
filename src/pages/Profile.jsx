import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useWallet } from "../hooks/useWallet";
import { getSigner } from "../utils/contract";

const SOCIALS = [
  { key: "twitter",   label: "X / Twitter",  placeholder: "@username or profile URL" },
  { key: "youtube",   label: "YouTube",       placeholder: "Channel name or URL" },
  { key: "twitch",    label: "Twitch",        placeholder: "@username or channel URL" },
  { key: "discord",   label: "Discord",       placeholder: "Username#0000 or server invite" },
  { key: "instagram", label: "Instagram",     placeholder: "@username or profile URL" },
];

export default function Profile() {
  const { user, refreshUser, linkWallet, getToken } = useAuth();
  const { connect, connected, address, loading: walletLoading } = useWallet();

  const [username, setUsername] = useState("");
  const [bio,      setBio]      = useState("");
  const [socials,  setSocials]  = useState({ twitter: "", youtube: "", twitch: "", discord: "", instagram: "" });

  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState(null);
  const [linking,  setLinking]  = useState(false);

  // Populate form from current user data
  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setBio(user.bio || "");
      setSocials({
        twitter:   user.socials?.twitter   || "",
        youtube:   user.socials?.youtube   || "",
        twitch:    user.socials?.twitch    || "",
        discord:   user.socials?.discord   || "",
        instagram: user.socials?.instagram || "",
      });
    }
  }, [user]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const token = getToken();
      const res = await fetch("/api/profile/update", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ username: username.trim(), bio: bio.trim(), socials }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: data.error }); return; }
      await refreshUser();
      setMsg({ ok: true, text: "Profile saved!" });
    } catch {
      setMsg({ ok: false, text: "Failed to save profile" });
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkWallet() {
    setLinking(true);
    setMsg(null);
    try {
      if (!connected) await connect();
      const signer = await getSigner();
      await linkWallet(address, signer);
      setMsg({ ok: true, text: "Wallet linked to your account!" });
    } catch (e) {
      setMsg({ ok: false, text: e.message || "Failed to link wallet" });
    } finally {
      setLinking(false);
    }
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center text-gray-400">
        Log in to manage your profile.
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-3xl font-black mb-1">Your Profile</h1>
      <p className="text-gray-400 text-sm mb-8">
        Set your pseudonym and social links to be featured in the community.
      </p>

      {msg && (
        <div className={`mb-6 p-3 rounded-xl text-sm ${msg.ok ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">

        {/* Account info (read-only) */}
        <div className="card">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Account</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Email</span>
            <span className="font-mono text-xs text-gray-300">{user.email}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-400">GCH Balance</span>
            <span className="font-bold text-avax-red">{(user.gchBalance || 0).toLocaleString()} GCH</span>
          </div>
          {user.role && user.role !== "user" && (
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-400">Role</span>
              <span className="badge bg-avax-red/20 text-avax-red capitalize">{user.role}</span>
            </div>
          )}
        </div>

        {/* Pseudonym */}
        <div className="card">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">
            Pseudonym <span className="text-avax-red">*</span>
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Required to receive prizes and appear in the community leaderboard.
            Letters, numbers and underscores only, 3–30 characters.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-semibold">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              maxLength={30}
              placeholder="YourGamertag"
              className="input flex-1"
            />
          </div>
        </div>

        {/* Bio */}
        <div className="card">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Bio</p>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Tell the community about yourself…"
            className="input w-full resize-none"
          />
          <p className="text-right text-xs text-gray-600 mt-1">{bio.length}/300</p>
        </div>

        {/* Social media */}
        <div className="card">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">
            Social Media
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Add channels where you've promoted GameChanger. These appear on your public profile.
          </p>
          <div className="space-y-3">
            {SOCIALS.map((s) => (
              <div key={s.key}>
                <label className="text-xs text-gray-400 font-semibold block mb-1">{s.label}</label>
                <input
                  type="text"
                  value={socials[s.key]}
                  onChange={(e) => setSocials((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  placeholder={s.placeholder}
                  className="input w-full text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Wallet linking */}
        <div className="card">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">
            Linked Wallet
          </p>
          {user.walletAddress ? (
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-green-400">
                {user.walletAddress.slice(0, 8)}…{user.walletAddress.slice(-6)}
              </span>
              <span className="badge bg-green-900/30 text-green-400 text-xs">Linked</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Link a wallet to enable on-chain purchases and earn GCH on-chain.
              </p>
              <button
                type="button"
                onClick={handleLinkWallet}
                disabled={linking || walletLoading}
                className="btn-secondary text-sm w-full"
              >
                {linking ? "Sign message in MetaMask…" : "Link Wallet"}
              </button>
            </>
          )}
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full py-3">
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
