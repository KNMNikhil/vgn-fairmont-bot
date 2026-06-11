"use client";

import { useEffect, useState } from "react";

export function WhitelistView() {
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newFlat, setNewFlat] = useState("");
  const [adding, setAdding] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchResidents = () => {
    fetch(`/api/residents?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setResidents(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchResidents();
    const interval = setInterval(fetchResidents, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim() || !newFlat.trim()) return;
    setAdding(true);
    const res = await fetch("/api/residents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: newPhone.trim(), name: newName.trim(), flat_number: newFlat.trim(), is_approved: true })
    });
    if (res.ok) {
      setSuccessMsg(`✓ ${newName || newPhone} authorized successfully!`);
      setTimeout(() => setSuccessMsg(""), 3000);
    }
    setNewPhone(""); setNewName(""); setNewFlat("");
    setAdding(false);
    fetchResidents();
  };

  const handleDelete = async (phone: string) => {
    if (!confirm(`Remove ${phone} from the whitelist?`)) return;
    await fetch(`/api/residents?phone=${encodeURIComponent(phone)}`, { method: "DELETE" });
    fetchResidents();
  };

  const filtered = residents.filter(r =>
    (r.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.flat_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.phone || "").includes(searchQuery)
  );

  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-white/40 text-sm tracking-wide uppercase font-medium">Loading Whitelist...</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 flex-1 overflow-y-auto bg-gradient-to-br from-[#0a0a0a] to-[#121212]">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-light text-white tracking-tight mb-1">Resident Whitelist</h2>
            <p className="text-white/40 text-sm">Manage authorized phone numbers for the VGN Fairmont Bot.</p>
          </div>
          <div className="flex items-center gap-2 bg-white/[0.02] border border-white/10 px-3 py-2 rounded-xl">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search by name, flat or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none w-56"
            />
          </div>
        </div>

        {/* Add Resident Card */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 mb-8">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-5 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Authorize New Resident
          </h3>

          <form onSubmit={handleAdd}>
            {/* Input Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">WhatsApp Number *</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  placeholder="e.g. 919876543210"
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">Flat / Door No. *</label>
                <input
                  type="text"
                  value={newFlat}
                  onChange={e => setNewFlat(e.target.value)}
                  placeholder="e.g. B4-2E"
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            {/* Button Row */}
            <div className="flex items-center justify-end gap-4">
              {successMsg && (
                <span className="text-emerald-400 text-sm font-medium animate-pulse">{successMsg}</span>
              )}
              <button
                type="submit"
                disabled={adding}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black font-bold text-sm px-6 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {adding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  "Authorize Resident"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Resident Count Badge */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-white/30 font-medium uppercase tracking-widest">
            {filtered.length} of {residents.length} resident{residents.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400/60">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Live
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 border-b border-white/10 text-white/40 text-[11px] uppercase tracking-widest">
              <tr>
                <th className="px-6 py-3.5 font-semibold">#</th>
                <th className="px-6 py-3.5 font-semibold">Phone Number</th>
                <th className="px-6 py-3.5 font-semibold">Name</th>
                <th className="px-6 py-3.5 font-semibold">Flat</th>
                <th className="px-6 py-3.5 font-semibold">Added On</th>
                <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.map((res: any, i: number) => (
                <tr key={res.phone} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-white/20 font-mono text-xs">{i + 1}</td>
                  <td className="px-6 py-4 font-mono text-white/80 text-xs">{res.phone}</td>
                  <td className="px-6 py-4 text-white/80">{res.name || <span className="text-white/20 italic text-xs">Not provided</span>}</td>
                  <td className="px-6 py-4">
                    <span className="bg-white/[0.06] text-white/70 px-2 py-0.5 rounded-md font-mono text-xs border border-white/[0.08]">{res.flat_number || "N/A"}</span>
                  </td>
                  <td className="px-6 py-4 text-white/30 text-xs">{new Date(res.created_at).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(res.phone)}
                      className="text-red-400/60 hover:text-red-400 hover:bg-red-400/10 text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <p className="text-white/30 text-sm">{searchQuery ? "No residents match your search" : "No residents authorized yet"}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
