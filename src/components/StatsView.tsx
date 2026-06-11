"use client";

import { useEffect, useState } from "react";

export function StatsView() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    function fetchStats() {
      fetch(`/api/stats?t=${Date.now()}`)
        .then((res) => res.json())
        .then((data) => {
          setStats(data);
          setLoading(false);
          setLastUpdated(new Date());
        })
        .catch(() => setLoading(false));
    }
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-white/40 text-sm tracking-wide uppercase font-medium">Loading Usage Data...</p>
      </div>
    </div>
  );

  if (!stats) return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-xl text-sm">
        Failed to load usage data. Please refresh.
      </div>
    </div>
  );

  const filtered = stats.userStats?.filter((user: any) =>
    (user.phone || "").includes(searchQuery) ||
    (user.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="p-8 flex-1 overflow-y-auto bg-gradient-to-br from-[#0a0a0a] to-[#121212]">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-light text-white tracking-tight mb-1">Usage & Costs</h2>
            <p className="text-white/40 text-sm">Monitor Gemini API token consumption and estimated costs per resident.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400/60">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Live · Updated {lastUpdated ? lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '...'}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -right-3 -top-3 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
            <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-widest mb-2">Total Tokens</p>
            <p className="text-3xl font-light text-white font-mono">{(stats.totalTokens || 0).toLocaleString()}</p>
            <p className="text-[10px] text-white/30 mt-1">All time usage</p>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -right-3 -top-3 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl" />
            <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest mb-2">Prompt Tokens</p>
            <p className="text-3xl font-light text-white font-mono">{(stats.totalPrompt || 0).toLocaleString()}</p>
            <p className="text-[10px] text-white/30 mt-1">Input to AI (context)</p>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -right-3 -top-3 w-20 h-20 bg-violet-500/10 rounded-full blur-2xl" />
            <p className="text-[11px] font-semibold text-violet-400 uppercase tracking-widest mb-2">Completion Tokens</p>
            <p className="text-3xl font-light text-white font-mono">{(stats.totalCompletion || 0).toLocaleString()}</p>
            <p className="text-[10px] text-white/30 mt-1">AI generated output</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-900/5 backdrop-blur-xl border border-emerald-500/20 shadow-2xl rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -right-3 -top-3 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl" />
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest mb-2">Estimated Cost</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-light text-emerald-400/60 font-mono">₹</span>
              <p className="text-3xl font-light text-emerald-400 font-mono">{stats.totalCostInr}</p>
            </div>
            <p className="text-[10px] text-emerald-400/40 mt-1">Gemini 2.5 Flash pricing</p>
          </div>
        </div>

        {/* Table Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <p className="text-xs text-white/30 font-medium uppercase tracking-widest">
            {filtered.length} resident{filtered.length !== 1 ? 's' : ''} · sorted by usage
          </p>
          <div className="flex items-center gap-2 bg-white/[0.02] border border-white/10 px-3 py-2 rounded-xl">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none w-52"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 border-b border-white/10 text-white/40 text-[11px] uppercase tracking-widest">
              <tr>
                <th className="px-6 py-3.5 font-semibold">#</th>
                <th className="px-6 py-3.5 font-semibold">Resident</th>
                <th className="px-6 py-3.5 font-semibold">Phone</th>
                <th className="px-6 py-3.5 font-semibold text-right">Prompt</th>
                <th className="px-6 py-3.5 font-semibold text-right">Completion</th>
                <th className="px-6 py-3.5 font-semibold text-right">Total Tokens</th>
                <th className="px-6 py-3.5 font-semibold text-right">Cost (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.map((user: any, i: number) => (
                <tr key={user.phone} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-white/20 font-mono text-xs">{i + 1}</td>
                  <td className="px-6 py-4 text-white/80 font-medium">{user.name || <span className="text-white/20 italic text-xs">Unknown</span>}</td>
                  <td className="px-6 py-4 font-mono text-white/50 text-xs">{user.phone}</td>
                  <td className="px-6 py-4 font-mono text-white/40 text-right text-xs">{(user.prompt || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 font-mono text-white/40 text-right text-xs">{(user.completion || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 font-mono text-white/80 text-right font-medium">{(user.total || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 font-mono text-emerald-400 text-right font-medium">₹ {user.costInr}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <p className="text-white/20 text-sm">{searchQuery ? "No residents match your search" : "No usage data available yet"}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pricing note */}
        <p className="text-center text-white/15 text-xs mt-5">
          Cost estimated using Gemini 2.5 Flash pricing · Input: $0.075/1M · Output: $0.30/1M · USD→INR: ₹83.5
        </p>
      </div>
    </div>
  );
}
