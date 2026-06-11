"use client";

import { useEffect, useState } from "react";

export function StatsView() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-white/50">Loading stats...</div>;
  if (!stats) return <div className="p-8 text-red-400">Failed to load stats.</div>;

  return (
    <div className="p-8 flex-1 overflow-y-auto">
      <h2 className="text-2xl font-semibold mb-6">Usage & Costs</h2>
      
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
          <p className="text-sm text-white/50 mb-1">Total Tokens</p>
          <p className="text-3xl font-mono">{stats.totalTokens?.toLocaleString()}</p>
        </div>
        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
          <p className="text-sm text-emerald-500/80 mb-1">Estimated Cost</p>
          <p className="text-3xl font-mono text-emerald-400">₹ {stats.totalCostInr}</p>
        </div>
      </div>

      <h3 className="text-xl font-medium mb-4">Cost by Resident</h3>
      <div className="bg-[#141414] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="px-6 py-3 font-medium">Phone Number</th>
              <th className="px-6 py-3 font-medium">Prompt Tokens</th>
              <th className="px-6 py-3 font-medium">Completion Tokens</th>
              <th className="px-6 py-3 font-medium">Total Tokens</th>
              <th className="px-6 py-3 font-medium text-right">Cost (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {stats.userStats?.map((user: any) => (
              <tr key={user.phone} className="hover:bg-white/[0.02]">
                <td className="px-6 py-4 font-mono">{user.phone}</td>
                <td className="px-6 py-4 font-mono text-white/60">{user.prompt?.toLocaleString()}</td>
                <td className="px-6 py-4 font-mono text-white/60">{user.completion?.toLocaleString()}</td>
                <td className="px-6 py-4 font-mono">{user.total?.toLocaleString()}</td>
                <td className="px-6 py-4 font-mono text-emerald-400 text-right">₹ {user.costInr}</td>
              </tr>
            ))}
            {stats.userStats?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-white/40">No usage data available yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
