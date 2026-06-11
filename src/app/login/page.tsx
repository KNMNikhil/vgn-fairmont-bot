"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Fade-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        setSuccess(true);
        // Fade out and redirect
        setTimeout(() => {
          router.replace("/");
          router.refresh();
        }, 600);
      } else {
        const data = await res.json();
        setError(data.error || "Invalid credentials. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center transition-all duration-500 ease-out`}
      style={{
        background: "radial-gradient(ellipse at 60% 20%, rgba(16, 185, 129, 0.08) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(99, 102, 241, 0.08) 0%, transparent 60%), #060b14",
      }}
    >
      {/* Blurred background overlay */}
      <div
        className={`absolute inset-0 backdrop-blur-sm transition-opacity duration-700`}
        style={{ opacity: visible && !success ? 1 : 0 }}
      />

      {/* Floating background orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Login Modal */}
      <div
        className={`relative z-10 w-full max-w-md mx-4 transition-all duration-700 ease-out`}
        style={{
          opacity: visible && !success ? 1 : 0,
          transform: visible && !success ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
        }}
      >
        {/* Glass Card */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

          <div className="p-10">
            {/* Logo / Title */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/10 border border-emerald-500/20 mb-5 shadow-lg shadow-emerald-500/10">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h1 className="text-2xl font-light text-white tracking-tight">Admin Dashboard</h1>
              <p className="text-white/30 text-sm mt-1.5 font-light">VGN Fairmont Bot Management</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/40 uppercase tracking-widest mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="Enter username"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(52,211,153,0.08)] transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/40 uppercase tracking-widest mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter password"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(52,211,153,0.08)] transition-all duration-200"
                />
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-medium py-3 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm tracking-wide"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Authenticating...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* Footer */}
            <p className="text-center text-white/15 text-xs mt-8 font-light">
              Secured access • VGN Fairmont
            </p>
          </div>

          {/* Bottom accent bar */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      </div>
    </div>
  );
}
