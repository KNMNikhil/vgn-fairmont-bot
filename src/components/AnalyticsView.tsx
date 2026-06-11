"use client";

import { useEffect, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StatCard({ color, label, value, sub }: { color: string; label: string; value: any; sub?: string }) {
  return (
    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden group">
      <div className={`absolute -right-4 -top-4 w-24 h-24 ${color} rounded-full blur-2xl transition-colors`} />
      <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${color.replace('bg-', 'text-').replace('/10', '-400')}`}>{label}</p>
      <p className="text-3xl font-light text-white font-mono tracking-tight">{value}</p>
      {sub && <p className="text-xs text-white/40 mt-1">{sub}</p>}
    </div>
  );
}

export function AnalyticsView() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [faqData, setFaqData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(30);

  useEffect(() => {
    function fetchAnalytics() {
      fetch(`/api/analytics?days=${days}&t=${Date.now()}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((resData) => {
          setData(resData);
          setLoading(false);
        });
    }
    fetchAnalytics();
    fetch(`/api/analytics/faq`, { cache: "no-store" })
      .then(res => res.json())
      .then(resData => { if (resData.questions) setFaqData(resData.questions); });
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, [days]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-white/40 text-sm tracking-wide uppercase font-medium">Loading Analytics...</p>
      </div>
    </div>
  );

  if (!data) return null;

  const totalInteractions = (data.features?.chat || 0) + (data.features?.tickets || 0) + (data.features?.orders || 0);
  const getPercentage = (val: number) => totalInteractions === 0 ? 0 : Math.round((val / totalInteractions) * 100);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxDayCount = data.dayOfWeekData ? Math.max(...data.dayOfWeekData.map((d: any) => d.count), 1) : 1;
  const growth = data.insights?.weekOverWeekGrowth || 0;
  const growthPositive = growth >= 0;

  return (
    <div className="p-8 flex-1 overflow-y-auto bg-gradient-to-br from-[#0a0a0a] to-[#121212]">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-light text-white tracking-tight mb-2">Live Analytics</h2>
            <p className="text-white/40 text-sm">Monitor bot usage, ticket volume, and user behavior in real-time.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/40 text-xs font-medium uppercase tracking-widest">Timeframe:</span>
            <select
              value={days}
              onChange={(e) => { setLoading(true); setDays(Number(e.target.value)); }}
              className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-4 py-2 outline-none focus:border-emerald-500/50 transition-colors appearance-none cursor-pointer pr-10"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px top 50%', backgroundSize: '10px auto' }}
            >
              <option value={7} className="bg-[#121212]">Last 7 Days</option>
              <option value={14} className="bg-[#121212]">Last 14 Days</option>
              <option value={21} className="bg-[#121212]">Last 21 Days</option>
              <option value={30} className="bg-[#121212]">Last 1 Month</option>
            </select>
          </div>
        </div>

        {/* Row 1: Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">Total Interactions</p>
            <p className="text-4xl font-light text-white font-mono tracking-tight">{totalInteractions}</p>
            <p className="text-xs text-white/40 mt-1">Across all channels</p>
          </div>
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-2">Total Tickets</p>
            <p className="text-4xl font-light text-white font-mono tracking-tight">{data.features?.tickets || 0}</p>
            <p className="text-xs text-white/40 mt-1">Open & resolved issues</p>
          </div>
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2">Total Orders</p>
            <p className="text-4xl font-light text-white font-mono tracking-tight">{data.features?.orders || 0}</p>
            <p className="text-xs text-white/40 mt-1">Store & service purchases</p>
          </div>
          {/* Week-over-week growth */}
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden">
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl ${growthPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}`} />
            <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${growthPositive ? 'text-emerald-400' : 'text-red-400'}`}>Period Growth</p>
            <div className="flex items-baseline gap-1">
              <p className={`text-4xl font-light font-mono tracking-tight ${growthPositive ? 'text-emerald-400' : 'text-red-400'}`}>{growthPositive ? '+' : ''}{growth}%</p>
            </div>
            <p className="text-xs text-white/40 mt-1">vs previous {days}-day period</p>
          </div>
        </div>

        {/* Row 2: User Insights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
          <StatCard color="bg-indigo-500/10" label="Unique Users" value={data.insights?.uniqueUsers || 0} sub="Active residents this period" />
          <StatCard color="bg-teal-500/10" label="New Residents" value={data.insights?.newUsers || 0} sub="First time using bot" />
          <StatCard color="bg-sky-500/10" label="Returning Users" value={data.insights?.returningUsers || 0} sub="Used bot before" />
          <StatCard color="bg-pink-500/10" label="Avg Msgs / User" value={data.insights?.avgMessagesPerUser || 0} sub="Conversation engagement" />
        </div>

        {/* Row 3: Bot Performance */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          <StatCard color="bg-cyan-500/10" label="AI Response Ratio" value={`${data.insights?.botRatio || 0}%`} sub="Bot replies per 100 msgs" />
          <StatCard color="bg-violet-500/10" label="Avg Reply Length" value={`${data.insights?.avgBotResponseLength || 0}`} sub="Words per AI response" />
          <StatCard color="bg-orange-500/10" label="Avg Chat Length" value={data.insights?.avgConversationLength || 0} sub="Messages per conversation" />
          <StatCard color="bg-rose-500/10" label="Unresolved Rate" value={`${data.insights?.unresolvedRate || 0}%`} sub="Open + in-progress tickets" />
        </div>

        {/* Row 4: Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Day of Week Heatmap */}
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest mb-5">Day of Week Traffic</h3>
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data.dayOfWeekData?.map((d: any) => {
                const pct = maxDayCount > 0 ? Math.round((d.count / maxDayCount) * 100) : 0;
                const isPeak = d.count === maxDayCount && maxDayCount > 0;
                return (
                  <div key={d.day} className="flex items-center gap-3">
                    <span className="text-xs text-white/40 font-mono w-8 shrink-0">{d.day}</span>
                    <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isPeak ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]' : 'bg-emerald-500/40'}`}
                        style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/40 font-mono w-6 text-right">{d.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 5 Residents */}
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest mb-5">Top 5 Most Active Residents</h3>
            <div className="space-y-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data.topResidents?.length > 0 ? data.topResidents.map((r: any, i: number) => {
                const maxMsgs = data.topResidents[0]?.messages || 1;
                const pct = Math.round((r.messages / maxMsgs) * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-base text-white/40 font-mono w-6 shrink-0 text-center">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 font-medium truncate">{r.name}</p>
                      <div className="h-1.5 w-full bg-white/5 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-indigo-400/70 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-white/40 font-mono shrink-0">{r.messages} msgs</span>
                  </div>
                );
              }) : (
                <p className="text-white/20 text-sm text-center py-4">No data yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Row 5: Feature Usage + Ticket Status + Ticket Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Feature Distribution */}
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest mb-5">Feature Usage</h3>
            <div className="space-y-5">
              {[
                { label: "General Chat", val: data.features?.chat || 0, color: "bg-emerald-500" },
                { label: "Complaints / Tickets", val: data.features?.tickets || 0, color: "bg-blue-500" },
                { label: "Shop Orders", val: data.features?.orders || 0, color: "bg-amber-500" },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-white/70 font-medium">{item.label}</span>
                    <span className="text-white/40 font-mono">{getPercentage(item.val)}% ({item.val})</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${getPercentage(item.val)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ticket Status */}
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest mb-5">Ticket Status</h3>
            <div className="flex items-center justify-around h-[140px]">
              {[
                { label: "Open", val: data.ticketStatus?.open || 0, color: "text-red-400", ring: "border-red-500/30", bg: "bg-red-500/10" },
                { label: "In Progress", val: data.ticketStatus?.in_progress || 0, color: "text-amber-400", ring: "border-amber-500/30", bg: "bg-amber-500/10" },
                { label: "Resolved", val: data.ticketStatus?.resolved || 0, color: "text-emerald-400", ring: "border-emerald-500/30", bg: "bg-emerald-500/10" },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center gap-2">
                  <div className={`w-16 h-16 rounded-2xl ${s.bg} border ${s.ring} flex items-center justify-center`}>
                    <span className={`text-2xl font-light font-mono ${s.color}`}>{s.val}</span>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-widest ${s.color}`}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ticket Category Breakdown */}
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest mb-5">Ticket Categories</h3>
            {data.ticketCategoryBreakdown?.length > 0 ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {data.ticketCategoryBreakdown.map((c: any, i: number) => {
                  const maxCat = data.ticketCategoryBreakdown[0]?.count || 1;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-white/70 font-medium w-36 truncate shrink-0">{c.category}</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400/70 rounded-full" style={{ width: `${Math.round((c.count / maxCat) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-white/40 font-mono w-6 text-right shrink-0">{c.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white/20 text-sm text-center py-8">No ticket data yet</p>
            )}
          </div>
        </div>

        {/* Row 6: Extra Insight Widgets */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-8">
          <StatCard color="bg-fuchsia-500/10" label="Words Processed" value={(data.insights?.totalWords || 0).toLocaleString()} sub="Total text volume handled" />
          <StatCard color="bg-lime-500/10" label="Busiest Day" value={data.insights?.busiestDay || "N/A"} sub={`${data.insights?.busiestDayPercentage || 0}% of total traffic`} />
          <StatCard color="bg-rose-500/10" label="Top Resident" value={data.insights?.topResidentName || "N/A"} sub="Most active user overall" />
        </div>

        {/* FAQ Section */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-7 relative overflow-hidden">
          <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest mb-6">Frequently Asked Questions (Live AI Analysis)</h3>
          <div className="space-y-4">
            {faqData.length > 0 ? (
              faqData.map((faq, idx) => (
                <div key={idx} className="bg-white/[0.03] border border-white/[0.05] p-4 rounded-xl">
                  <p className="text-white/80 font-medium text-sm mb-1">{idx + 1}. &quot;{faq.question}&quot;</p>
                  <p className="text-white/40 text-xs">{faq.reason}</p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-3" />
                <p className="text-xs text-white/30">AI is analyzing recent conversations...</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
