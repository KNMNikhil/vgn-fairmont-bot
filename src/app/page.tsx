"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { ConversationWithLastMessage, Message } from "@/lib/types";

import { WhitelistView } from "@/components/WhitelistView";
import { StatsView } from "@/components/StatsView";
import { AnalyticsView } from "@/components/AnalyticsView";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"chat" | "whitelist" | "stats" | "analytics">("chat");
  const [conversations, setConversations] = useState<ConversationWithLastMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [convoSearch, setConvoSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabled = useRef(true);

  // Sync activeTab with URL hash for refresh persistence
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "whitelist" || hash === "stats" || hash === "chat" || hash === "analytics") {
      setActiveTab(hash as any);
    }
  }, []);

  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // Check if the user has scrolled up by more than 100 pixels from the bottom
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < 100;
    
    isAutoScrollEnabled.current = isNearBottom;
    setShowScrollDown(!isNearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    isAutoScrollEnabled.current = true;
    setShowScrollDown(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const selected = conversations.find((c) => c.id === selectedId);

  const fetchConversations = useCallback(async () => {
    const res = await fetch(`/api/conversations?t=${Date.now()}`);
    const data = await res.json();
    setConversations(data);
  }, []);

  const fetchMessages = useCallback(async (convoId: string) => {
    const res = await fetch(`/api/conversations/${convoId}/messages?t=${Date.now()}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      setMessages(data);
    } else {
      console.error("Failed to fetch messages. Data returned:", data);
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedId) {
      isAutoScrollEnabled.current = true; // Reset auto-scroll when changing conversations
      setShowScrollDown(false);
      fetchMessages(selectedId);
    }
  }, [selectedId, fetchMessages]);

  useEffect(() => {
    if (activeTab === "chat" && isAutoScrollEnabled.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 50);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isAutoScrollEnabled.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    // Poll for new messages every 3 seconds as a robust fallback for realtime.
    // Polling is automatically paused when the browser tab is hidden to save resources.
    let interval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (interval) return; // already running
      interval = setInterval(() => {
        fetchConversations();
        if (selectedId) fetchMessages(selectedId);
      }, 3000);
    }

    function stopPolling() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopPolling();
      } else {
        // Resume and immediately refresh when tab becomes visible
        fetchConversations();
        if (selectedId) fetchMessages(selectedId);
        startPolling();
      }
    }

    if (!document.hidden) startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedId, fetchConversations, fetchMessages]);

  async function toggleMode() {
    if (!selected) return;
    const newMode = selected.mode === "agent" ? "human" : "agent";
    await fetch(`/api/conversations/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: newMode }),
    });
    setConversations((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, mode: newMode } : c))
    );
  }

  async function toggleBlock() {
    if (!selected) return;
    const newBlockState = !selected.is_blocked;
    await fetch(`/api/conversations/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_blocked: newBlockState }),
    });
    setConversations((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, is_blocked: newBlockState } : c))
    );
  }

  async function handleSend() {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    await fetch(`/api/conversations/${selectedId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input.trim() }),
    });
    setInput("");
    setSending(false);
    fetchMessages(selectedId);
    scrollToBottom();
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString([], { day: "2-digit", month: "short" });
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${date}, ${time}`;
  }

  function getInitials(name: string | null, phone: string) {
    if (name) return name.slice(0, 2).toUpperCase();
    return phone.slice(-2);
  }

  function renderMessageContent(content: string) {
    let cleanText = content;
    let imageId = null;
    let audioId = null;

    const imageMatch = content.match(/\[IMAGE_ID:\s*([^\]]+)\]/);
    if (imageMatch) {
      imageId = imageMatch[1];
      cleanText = cleanText.replace(imageMatch[0], "").replace("[User sent an image]", "").trim();
    }

    const audioMatch = content.match(/\[AUDIO_ID:\s*([^\]]+)\]/);
    if (audioMatch) {
      audioId = audioMatch[1];
      cleanText = cleanText.replace(audioMatch[0], "").replace("[Voice Message]", "").trim();
    }

    if (!audioId && !imageId && cleanText === "[Voice Message]") {
       return <p className="text-white/60 italic">🎤 Voice message (audio unavailable)</p>;
    }
    
    if (!audioId && !imageId && cleanText === "[User sent an image]") {
       return <p className="text-white/60 italic">🖼️ Image (media unavailable)</p>;
    }

    return (
      <div className="flex flex-col gap-2">
        {cleanText && <p className="whitespace-pre-wrap">{cleanText}</p>}
        {imageId && (
          <div className="rounded-lg overflow-hidden border border-white/10 mt-1 max-w-[280px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${imageId}`} alt="Shared media" className="w-full h-auto object-contain bg-black/20" />
          </div>
        )}
        {audioId && (
          <div className="mt-1">
            <audio src={`/api/media/${audioId}`} controls className="h-10 w-[240px]" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#050505] font-sans selection:bg-emerald-500/30">
      
      {/* Far-Left Slim Navigation Sidebar */}
      <div className="w-[72px] flex flex-col items-center py-6 border-r border-white/5 bg-[#080808] z-30 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-8">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>

        <div className="flex flex-col gap-4 w-full px-3">
          <button 
            onClick={() => setActiveTab("chat")}
            className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group ${activeTab === "chat" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:bg-white/5 hover:text-white/70"}`}
          >
            {activeTab === "chat" && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-[9px] font-medium uppercase tracking-wider">Chat</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("whitelist")}
            className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group ${activeTab === "whitelist" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:bg-white/5 hover:text-white/70"}`}
          >
            {activeTab === "whitelist" && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span className="text-[9px] font-medium uppercase tracking-wider">Access</span>
          </button>

          <button 
            onClick={() => setActiveTab("stats")}
            className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group ${activeTab === "stats" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:bg-white/5 hover:text-white/70"}`}
          >
            {activeTab === "stats" && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line>
            </svg>
            <span className="text-[9px] font-medium uppercase tracking-wider">Usage</span>
          </button>

          <button 
            onClick={() => setActiveTab("analytics")}
            className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group ${activeTab === "analytics" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:bg-white/5 hover:text-white/70"}`}
          >
            {activeTab === "analytics" && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            <span className="text-[9px] font-medium uppercase tracking-wider">Data</span>
          </button>
        </div>
      </div>

      {/* Chat Conversation Sidebar (Only visible in chat tab) */}
      <div className={`w-[320px] flex-col border-r border-white/5 bg-[#0a0a0a] relative overflow-hidden flex-shrink-0 ${activeTab === "chat" ? "flex" : "hidden"}`}>
        {/* Subtle background glow */}
        <div className="absolute top-0 left-0 w-full h-64 bg-emerald-500/5 blur-[100px] pointer-events-none" />

        {/* Sidebar Header */}
        <div className="px-6 py-5 border-b border-white/[0.04] relative z-10">
          <h1 className="text-[15px] font-semibold text-white/90 leading-tight tracking-tight">Active Chats</h1>
          <p className="text-[11px] font-medium text-emerald-500/80 uppercase tracking-widest mt-1">Live Feed</p>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto relative z-10 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex flex-col">
            <div className="px-4 py-3 border-b border-white/[0.04] sticky top-0 bg-[#0a0a0a] z-20">
              <input 
                type="text" 
                placeholder="Search chats..." 
                value={convoSearch}
                onChange={e => setConvoSearch(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            
            {conversations.filter(c => (c.name || "").toLowerCase().includes(convoSearch.toLowerCase()) || c.phone.includes(convoSearch)).length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-xs text-white/30">No matching chats</p>
            </div>
          )}
          {conversations.filter(c => (c.name || "").toLowerCase().includes(convoSearch.toLowerCase()) || c.phone.includes(convoSearch)).map((convo) => {
            const isSelected = selectedId === convo.id;
            return (
              <button
                key={convo.id}
                onClick={() => setSelectedId(convo.id)}
                className={`w-full text-left px-4 py-3.5 transition-all duration-150 relative group ${
                  isSelected ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                }`}
              >
                {isSelected && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-emerald-500 rounded-r" />
                )}
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold">
                    {getInitials(convo.name, convo.phone)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${convo.is_blocked ? "text-red-400 line-through" : "text-white/90"} truncate`}>
                        {convo.name || convo.phone}
                      </span>
                      <span className="text-[10px] text-white/30 flex-shrink-0">
                        {formatTime(convo.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      {convo.last_message ? (
                        <p className="text-xs text-white/40 truncate">{convo.last_message}</p>
                      ) : (
                        <span />
                      )}
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 uppercase tracking-wide ${
                          convo.mode === "agent"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {convo.mode === "agent" ? "AI" : "You"}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          </div>
      </div>

      {/* Main Content Area */}
      <div className={activeTab === "whitelist" ? "flex-1 flex flex-col min-w-0" : "hidden"}>
        <WhitelistView />
      </div>
      <div className={activeTab === "stats" ? "flex-1 flex flex-col min-w-0" : "hidden"}>
        <StatsView />
      </div>
      <div className={activeTab === "analytics" ? "flex-1 flex flex-col min-w-0" : "hidden"}>
        <AnalyticsView />
      </div>
      
      {/* Chat Panel */}
      <div className={activeTab === "chat" ? "flex-1 flex flex-col min-w-0" : "hidden"}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white/40">Select a conversation</p>
              <p className="text-xs text-white/20 mt-1">Choose from the list to start chatting</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between" style={{ background: "#141414" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white text-xs font-semibold">
                  {getInitials(selected.name, selected.phone)}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white leading-tight">
                    {selected.name || selected.phone}
                  </h2>
                  <p className="text-xs text-white/40 leading-tight mt-0.5">{selected.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleBlock}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    selected.is_blocked
                      ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20"
                      : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"
                  }`}
                >
                  {selected.is_blocked ? "Unblock User" : "Block User"}
                </button>
                <button
                  onClick={toggleMode}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    selected.mode === "agent"
                      ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
                      : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${selected.mode === "agent" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {selected.mode === "agent" ? "AI Mode" : "Human Mode"}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
              style={{
                backgroundImage: "radial-gradient(circle at 20% 80%, rgba(16,185,129,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(16,185,129,0.02) 0%, transparent 50%)",
              }}
            >
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const showTime = i === messages.length - 1 || messages[i + 1]?.role !== msg.role;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-start" : "justify-end"}`}
                  >
                    <div className={`flex flex-col ${isUser ? "items-start" : "items-end"} max-w-[65%]`}>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isUser
                            ? "bg-white/[0.07] text-white/90 rounded-tl-sm border border-white/[0.06]"
                            : "bg-emerald-600 text-white rounded-tr-sm"
                        }`}
                      >
                        {renderMessageContent(msg.content)}
                      </div>
                      {showTime && (
                        <p className="text-[10px] text-white/25 mt-1.5 px-1">
                          {!isUser && <span className="text-emerald-500/60 mr-1">AI ·</span>}
                          {formatTime(msg.created_at)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar & Floating Scroll Button */}
            <div className="relative px-6 py-4 border-t border-white/[0.06] bg-[#0a0a0a]">
              {showScrollDown && (
                <button
                  onClick={scrollToBottom}
                  className="absolute -top-12 left-1/2 -translate-x-1/2 w-8 h-8 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-black/50 backdrop-blur-md transition-all z-20"
                  aria-label="Scroll to bottom"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <polyline points="19 12 12 19 5 12"></polyline>
                  </svg>
                </button>
              )}
              <div className="flex items-center gap-3 bg-white/[0.06] rounded-xl px-4 py-2.5 border border-white/[0.06] focus-within:border-emerald-500/40 transition-colors">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={selected.is_blocked ? "User is blocked" : "Type a message..."}
                  disabled={selected.is_blocked}
                  className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/25 focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim() || selected.is_blocked}
                  className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center flex-shrink-0"
                  aria-label="Send"
                >
                  {sending ? (
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
