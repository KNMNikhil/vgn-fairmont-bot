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
    if (!newPhone.trim()) return;
    
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

  if (loading) return <div className="p-8 text-white/50">Loading whitelist...</div>;

  return (
    <div className="p-8 flex-1 overflow-y-auto">
      <h2 className="text-2xl font-semibold mb-2">Resident Whitelist</h2>
      <p className="text-white/50 mb-8">Only these phone numbers are allowed to message the bot.</p>
      
      <div className="bg-[#141414] border border-white/10 rounded-xl p-6 mb-8">
        <h3 className="text-sm font-medium text-white/80 mb-4">Add Approved Resident</h3>
        <form onSubmit={handleAdd} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs text-white/40 mb-1">WhatsApp Number (with country code, e.g. 919876543210)</label>
            <input 
              type="text" 
              value={newPhone} 
              onChange={e => setNewPhone(e.target.value)} 
              placeholder="91..." 
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-white/40 mb-1">Name (Optional)</label>
            <input 
              type="text" 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              placeholder="John Doe" 
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-white/40 mb-1">Flat (Optional)</label>
            <input 
              type="text" 
              value={newFlat} 
              onChange={e => setNewFlat(e.target.value)} 
              placeholder="A-101" 
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <button 
            type="submit" 
            disabled={adding}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2 rounded-lg transition-colors h-[42px]"
          >
            {adding ? "Adding..." : "Add to Whitelist"}
          </button>
        </form>
      </div>

      <div className="bg-[#141414] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="px-6 py-3 font-medium">Phone Number</th>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Flat</th>
              <th className="px-6 py-3 font-medium">Added On</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {residents.map((res: any) => (
              <tr key={res.phone} className="hover:bg-white/[0.02]">
                <td className="px-6 py-4 font-mono">{res.phone}</td>
                <td className="px-6 py-4">{res.name || <span className="text-white/30">—</span>}</td>
                <td className="px-6 py-4">{res.flat_number || <span className="text-white/30">—</span>}</td>
                <td className="px-6 py-4 text-white/60">{new Date(res.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleDelete(res.phone)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {residents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-white/40">No residents whitelisted yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
