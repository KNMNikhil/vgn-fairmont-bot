"use client";

import { useEffect, useState } from "react";

export function AnalyticsView() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [faqData, setFaqData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(30);

  useEffect(() => {
    function fetchAnalytics() {
      fetch(`/api/analytics?days=${days}&t=${Date.now()}`)
        .then((res) => res.json())
        .then((resData) => {
          setData(resData);
          setLoading(false);
        });
    }
    
    // Initial fetch
    fetchAnalytics();
    
    // Fetch FAQ only once on mount to save costs
    fetch(`/api/analytics/faq`)
      .then(res => res.json())
      .then(resData => {
        if (resData.questions) {
          setFaqData(resData.questions);
        }
      });
    
    // Poll analytics every 10 seconds
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

  // Find max message count for the timeline
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxTimelineMessages = data.timeline?.length > 0 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? Math.max(...data.timeline.map((t: any) => t.count)) 
    : 0;

  const totalInteractions = data.features.chat + data.features.tickets + data.features.orders;
  
  const getPercentage = (val: number) => {
    if (totalInteractions === 0) return 0;
    return Math.round((val / totalInteractions) * 100);
  };

  return (
    <div className="p-8 flex-1 overflow-y-auto bg-gradient-to-br from-[#0a0a0a] to-[#121212]">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-light text-white tracking-tight mb-2">Live Analytics</h2>
            <p className="text-white/40 text-sm">Monitor bot usage patterns, ticket volume, and user behavior in real-time.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/40 text-xs font-medium uppercase tracking-widest">Timeframe:</span>
            <select 
              value={days}
              onChange={(e) => {
                setLoading(true);
                setDays(Number(e.target.value));
              }}
              className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-4 py-2 outline-none focus:border-emerald-500/50 transition-colors appearance-none cursor-pointer pr-10 relative"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px top 50%', backgroundSize: '10px auto' }}
            >
              <option value={7} className="bg-[#121212]">Last 7 Days</option>
              <option value={14} className="bg-[#121212]">Last 14 Days</option>
              <option value={21} className="bg-[#121212]">Last 21 Days</option>
              <option value={30} className="bg-[#121212]">Last 1 Month</option>
            </select>
          </div>
        </div>
        
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl transition-colors" />
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">Total Interactions</p>
            <p className="text-4xl font-light text-white font-mono tracking-tight">{totalInteractions}</p>
          </div>
          
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl transition-colors" />
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-2">Total Tickets</p>
            <p className="text-4xl font-light text-white font-mono tracking-tight">{data.features.tickets}</p>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl transition-colors" />
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-2">Total Orders</p>
            <p className="text-4xl font-light text-white font-mono tracking-tight">{data.features.orders}</p>
          </div>
        </div>

        {/* Deep Insights Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl transition-colors" />
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Unique Users</p>
            <p className="text-3xl font-light text-white font-mono tracking-tight">{data.insights?.uniqueUsers || 0}</p>
            <p className="text-xs text-white/40 mt-1">Active residents in this period</p>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl transition-colors" />
            <p className="text-xs font-semibold text-pink-400 uppercase tracking-widest mb-2">Engagement</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-light text-white font-mono tracking-tight">{data.insights?.avgMessagesPerUser || 0}</p>
              <span className="text-xs text-white/40">msgs/user</span>
            </div>
            <p className="text-xs text-white/40 mt-1">Average conversation length</p>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl transition-colors" />
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-2">Busiest Day</p>
            <p className="text-2xl font-light text-white tracking-tight leading-none mt-1">{data.insights?.busiestDay || "N/A"}</p>
            <p className="text-xs text-white/40 mt-2">Accounts for {data.insights?.busiestDayPercentage || 0}% of traffic</p>
          </div>
        </div>

        {/* Deep Insights Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl transition-colors" />
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-2">Words Processed</p>
            <p className="text-3xl font-light text-white font-mono tracking-tight">{data.insights?.totalWords?.toLocaleString() || 0}</p>
            <p className="text-xs text-white/40 mt-1">Estimated text volume handled</p>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl transition-colors" />
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-widest mb-2">Top Resident</p>
            <p className="text-xl font-medium text-white tracking-tight leading-tight mt-1 truncate">{data.insights?.topResidentName || "N/A"}</p>
            <p className="text-xs text-white/40 mt-2">Most active user overall</p>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl transition-colors" />
            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-2">AI Response Ratio</p>
            <p className="text-3xl font-light text-white font-mono tracking-tight">{data.insights?.botRatio || 0}%</p>
            <p className="text-xs text-white/40 mt-1">AI messages per 100 user messages</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Feature Distribution */}
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-7 relative overflow-hidden">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest mb-6">Feature Usage Distribution</h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/80 font-medium">General Chat</span>
                  <span className="text-white/40 font-mono">{getPercentage(data.features.chat)}% ({data.features.chat})</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${getPercentage(data.features.chat)}%` }} />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/80 font-medium">Complaints / Tickets</span>
                  <span className="text-white/40 font-mono">{getPercentage(data.features.tickets)}% ({data.features.tickets})</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${getPercentage(data.features.tickets)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/80 font-medium">Shop Orders</span>
                  <span className="text-white/40 font-mono">{getPercentage(data.features.orders)}% ({data.features.orders})</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${getPercentage(data.features.orders)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Ticket Status */}
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-7 relative overflow-hidden">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest mb-6">Ticket Status</h3>
            
            <div className="flex items-center justify-center gap-8 h-[160px]">
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-full border-4 border-red-500/20 flex items-center justify-center relative">
                  <div className="absolute inset-0 border-4 border-red-500 rounded-full" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 50%)' }} />
                  <span className="text-xl font-mono text-white">{data.ticketStatus.open}</span>
                </div>
                <span className="text-xs text-red-400 font-medium uppercase tracking-wider">Open</span>
              </div>
              
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-full border-4 border-amber-500/20 flex items-center justify-center relative">
                  <div className="absolute inset-0 border-4 border-amber-500 rounded-full" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 50%)' }} />
                  <span className="text-xl font-mono text-white">{data.ticketStatus.in_progress}</span>
                </div>
                <span className="text-xs text-amber-400 font-medium uppercase tracking-wider">In Progress</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-full border-4 border-emerald-500/20 flex items-center justify-center relative">
                  <div className="absolute inset-0 border-4 border-emerald-500 rounded-full" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 50%)' }} />
                  <span className="text-xl font-mono text-white">{data.ticketStatus.resolved}</span>
                </div>
                <span className="text-xs text-emerald-400 font-medium uppercase tracking-wider">Resolved</span>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Traffic Timeline */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-7 relative overflow-hidden mb-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest">Daily Traffic Timeline</h3>
            {maxTimelineMessages > 0 && (
              <div className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Peak: {maxTimelineMessages} msgs
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <div className="flex items-end justify-start gap-2 h-32 mt-4 border-b border-white/10 pb-2 relative min-w-full" style={{ width: `${Math.max(100, data.timeline?.length * 3)}%` }}>
              {maxTimelineMessages === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-white/30 text-sm font-medium tracking-wide">No data available for this timeframe</p>
                </div>
              ) : (
                data.timeline?.map((item: { date: string, count: number }, index: number) => {
                  const height = (item.count / maxTimelineMessages) * 100;
                  const isPeak = item.count === maxTimelineMessages && maxTimelineMessages > 0;
                  
                  // Format date for tooltip (e.g., Jun 5)
                  const d = new Date(item.date);
                  const shortDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  
                  return (
                    <div key={index} className="flex flex-col items-center flex-1 min-w-[20px] max-w-[40px] gap-2 group relative">
                      <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-2 py-1 rounded shadow-xl border border-white/10 z-10 whitespace-nowrap">
                        {shortDate}: {item.count} msg
                      </div>
                      <div 
                        className={`w-full rounded-t-sm transition-all duration-300 ${isPeak ? 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.4)]' : 'bg-emerald-500/40 hover:bg-emerald-500/60'}`}
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                    </div>
                  );
                })
              )}
            </div>
            {/* Timeline Axis Labels */}
            {maxTimelineMessages > 0 && data.timeline?.length > 0 && (
              <div className="flex justify-between text-[10px] text-white/30 font-mono mt-2 px-1 w-full" style={{ width: `${Math.max(100, data.timeline?.length * 3)}%` }}>
                <span>{new Date(data.timeline[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <span>{new Date(data.timeline[Math.floor(data.timeline.length / 2)].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <span>{new Date(data.timeline[data.timeline.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Frequently Asked Questions */}
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
