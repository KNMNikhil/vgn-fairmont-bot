"use client";

import { useEffect, useState } from "react";

export function WhitelistView() {
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newFlat, setNewFlat] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchResidents = () => {
    fetch("/api/residents")
      .then((res) => res.json())
      .then((data) => {
        setResidents(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchResidents();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim() || !newFlat.trim()) return;
    
    setAdding(true);
    await fetch("/api/residents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: newPhone,
        name: newName,
        flat_number: newFlat,
        is_approved: true
      })
    });
    
    setNewPhone("");
    setNewName("");
    setNewFlat("");
    setAdding(false);
    fetchResidents();
  };

  const handleDelete = async (phone: string) => {
    if (!confirm(`Are you sure you want to remove ${phone} from the whitelist?`)) return;
    
    await fetch(`/api/residents?phone=${encodeURIComponent(phone)}`, {
      method: "DELETE"
    });
    fetchResidents();
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-white/40 text-sm tracking-wide uppercase font-medium">Loading Whitelist...</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 flex-1 overflow-y-auto bg-gradient-to-br from-[#0a0a0a] to-[#121212]">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h2 className="text-3xl font-light text-white tracking-tight mb-2">Resident Whitelist</h2>
          <p className="text-white/40 text-sm">Manage authorized phone numbers that can interact with the WhatsApp AI Agent.</p>
        </div>
        
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-7 mb-10 transition-all duration-300 hover:bg-white/[0.03]">
          <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest mb-6 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
            Add New Resident
          </h3>
          <form onSubmit={handleAdd} className="flex flex-wrap gap-5 items-start">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wide mb-2">WhatsApp Number</label>
              <input 
                type="text" 
                value={newPhone} 
                onChange={e => setNewPhone(e.target.value)} 
                placeholder="e.g. 919876543210" 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                required
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wide mb-2">Name (Optional)</label>
              <input 
                type="text" 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                placeholder="John Doe" 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wide mb-2">Flat / Door No.</label>
              <input 
                type="text" 
                value={newFlat} 
                onChange={e => setNewFlat(e.target.value)} 
                placeholder="e.g. B4-2E or D10F" 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                required
              />
              <p className="text-[10px] text-white/30 mt-2 px-1">Required: Provide full flat number</p>
            </div>
            <div className="w-full flex sm:w-auto pt-[28px]">
              <button 
                type="submit" 
                disabled={adding}
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-white font-medium px-8 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {adding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Authorize
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 border-b border-white/10 text-white/50 text-xs uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4 font-medium">Phone Number</th>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Flat</th>
                <th className="px-6 py-4 font-medium">Added On</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {residents.map((res: any) => (
                <tr key={res.phone} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="px-6 py-4 font-mono text-white/90">{res.phone}</td>
                  <td className="px-6 py-4 text-white/80">{res.name || <span className="text-white/20 italic">Not provided</span>}</td>
                  <td className="px-6 py-4">
                    <span className="bg-white/10 text-white/90 px-2.5 py-1 rounded-md font-mono text-xs border border-white/5">{res.flat_number || "N/A"}</span>
                  </td>
                  <td className="px-6 py-4 text-white/40">{new Date(res.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDelete(res.phone)}
                      className="text-red-400/70 hover:text-red-400 hover:bg-red-400/10 px-3 py-1.5 rounded-lg transition-all"
                    >
                      Revoke Access
                    </button>
                  </td>
                </tr>
              ))}
              {residents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                      </div>
                      <p className="text-white/40 font-medium">No residents authorized yet</p>
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
