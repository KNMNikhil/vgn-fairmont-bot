"use client";

import { useEffect, useState } from "react";

export function StatsView() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    function fetchStats() {
      fetch(`/api/stats?t=${Date.now()}`)
        .then((res) => res.json())
        .then((data) => {
          setStats(data);
          setLoading(false);
        });
    }
    
    // Initial fetch
    fetchStats();
    
    // Poll every 3 seconds
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-white/40 text-sm tracking-wide uppercase font-medium">Loading Stats...</p>
      </div>
    </div>
  );
  
  if (!stats) return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-xl flex items-center gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        Failed to load stats. Please try again later.
      </div>
    </div>
  );

  return (
    <div className="p-8 flex-1 overflow-y-auto bg-gradient-to-br from-[#0a0a0a] to-[#121212]">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h2 className="text-3xl font-light text-white tracking-tight mb-2">Usage & Costs</h2>
          <p className="text-white/40 text-sm">Monitor Gemini API token consumption and estimated costs.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-7 flex flex-col relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/[0.02] rounded-full blur-2xl group-hover:bg-white/[0.04] transition-colors" />
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Total Tokens Used</p>
            <p className="text-4xl font-light text-white font-mono tracking-tight">{stats.totalTokens?.toLocaleString()}</p>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-900/5 backdrop-blur-xl border border-emerald-500/20 shadow-2xl shadow-emerald-900/10 rounded-2xl p-7 flex flex-col relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
            <p className="text-xs font-semibold text-emerald-500/80 uppercase tracking-widest mb-2">Estimated Cost</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-light text-emerald-500/60 font-mono">₹</span>
              <p className="text-4xl font-light text-emerald-400 font-mono tracking-tight">{stats.totalCostInr}</p>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Cost Breakdown by Resident
          </h3>
          <div className="w-full sm:w-64">
            <input 
              type="text" 
              placeholder="Search by phone..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 border-b border-white/10 text-white/50 text-xs uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4 font-medium">Phone Number</th>
                <th className="px-6 py-4 font-medium">Prompt Tokens</th>
                <th className="px-6 py-4 font-medium">Completion Tokens</th>
                <th className="px-6 py-4 font-medium">Total Tokens</th>
                <th className="px-6 py-4 font-medium text-right">Cost (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {stats.userStats?.filter((user: any) => user.phone.includes(searchQuery)).map((user: any) => (
                <tr key={user.phone} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-6 py-4 font-mono text-white/90">{user.phone}</td>
                  <td className="px-6 py-4 font-mono text-white/50">{user.prompt?.toLocaleString()}</td>
                  <td className="px-6 py-4 font-mono text-white/50">{user.completion?.toLocaleString()}</td>
                  <td className="px-6 py-4 font-mono text-white/80">{user.total?.toLocaleString()}</td>
                  <td className="px-6 py-4 font-mono text-emerald-400 text-right">₹ {user.costInr}</td>
                </tr>
              ))}
              {stats.userStats?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      </div>
                      <p className="text-white/40 font-medium">No usage data available yet</p>
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
