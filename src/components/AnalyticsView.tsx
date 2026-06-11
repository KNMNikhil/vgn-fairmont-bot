"use client";

import { useEffect, useState } from "react";

export function AnalyticsView() {
  const [data, setData] = useState<any>(null);
  const [faqData, setFaqData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function fetchAnalytics() {
      fetch(`/api/analytics?t=${Date.now()}`)
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
  }, []);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-white/40 text-sm tracking-wide uppercase font-medium">Loading Analytics...</p>
      </div>
    </div>
  );
  
  if (!data) return null;

  // Find peak hour
  const maxMessages = Math.max(...data.peakHours);
  const peakHourIndex = data.peakHours.indexOf(maxMessages);
  const formatHour = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12} ${ampm}`;
  };

  const totalInteractions = data.features.chat + data.features.tickets + data.features.orders;
  
  const getPercentage = (val: number) => {
    if (totalInteractions === 0) return 0;
    return Math.round((val / totalInteractions) * 100);
  };

  return (
    <div className="p-8 flex-1 overflow-y-auto bg-gradient-to-br from-[#0a0a0a] to-[#121212]">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h2 className="text-3xl font-light text-white tracking-tight mb-2">Live Analytics</h2>
          <p className="text-white/40 text-sm">Monitor bot usage patterns, ticket volume, and user behavior in real-time.</p>
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

        {/* Peak Hours Heatmap */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-7 relative overflow-hidden mb-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest">Peak Usage Hours</h3>
            <div className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Peak: {formatHour(peakHourIndex)} ({maxMessages} msgs)
            </div>
          </div>
          
          <div className="flex items-end justify-between gap-1 h-32 mt-4 border-b border-white/10 pb-2">
            {data.peakHours.map((count: number, index: number) => {
              const height = maxMessages > 0 ? (count / maxMessages) * 100 : 0;
              const isPeak = index === peakHourIndex;
              return (
                <div key={index} className="flex flex-col items-center flex-1 gap-2 group relative">
                  <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-2 py-1 rounded shadow-xl border border-white/10 z-10 whitespace-nowrap">
                    {formatHour(index)}: {count}
                  </div>
                  <div 
                    className={`w-full rounded-t-sm transition-all duration-300 ${isPeak ? 'bg-emerald-500' : 'bg-emerald-500/30 hover:bg-emerald-500/50'}`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-white/30 font-mono mt-2 px-1">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>
        </div>

        {/* Frequently Asked Questions */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-7 relative overflow-hidden">
          <h3 className="text-sm font-semibold text-white/90 uppercase tracking-widest mb-6">Frequently Asked Questions (Live AI Analysis)</h3>
          
          <div className="space-y-4">
            {faqData.length > 0 ? (
              faqData.map((faq, idx) => (
                <div key={idx} className="bg-white/[0.03] border border-white/[0.05] p-4 rounded-xl">
                  <p className="text-white/80 font-medium text-sm mb-1">{idx + 1}. "{faq.question}"</p>
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
