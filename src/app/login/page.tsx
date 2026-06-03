"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, getAdminToken, API_BASE_URL } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("expired") === "true") {
        setSessionExpired(true);
      }
    }

    if (getAdminToken()) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSessionExpired(false);

    const normalizedEmail = email.trim().replace(/^['"]|['"]$/g, '');
    const normalizedPassword = password.trim().replace(/^['"]|['"]$/g, '');

    if (!normalizedEmail || !normalizedPassword) {
      setError("Please enter admin email and password.");
      setLoading(false);
      return;
    }

    try {
      await api.login({ email: normalizedEmail, password: normalizedPassword });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-screen flex items-center justify-center bg-[#ECECEE] px-4">
      {/* Login Card Container */}
      <div 
        className="w-full max-w-[420px] bg-white border border-[#EBEBEF] rounded-[24px] shadow-sm animate-fade-in relative"
        style={{ padding: "28px" }}
      >
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-[28px] font-bold text-[#141414]">Admin Login</h1>
        </div>

        {/* Session Expired Notification */}
        {sessionExpired && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs animate-fade-in flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-amber-700">Session Expired</span>
              <span className="text-amber-600 leading-relaxed">Your connection expired due to inactivity. Please sign in again.</span>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-[#9A1223] text-xs animate-fade-in flex items-start gap-3 font-semibold">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] text-[#55555A] font-medium pl-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="w-full bg-[#F2F2F3] border border-[#EBEBEF] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
              style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
              placeholder="admin@yourdomain.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] text-[#55555A] font-medium pl-1" htmlFor="password">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                className="w-full bg-[#F2F2F3] border border-[#EBEBEF] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "70px", paddingTop: "12px", paddingBottom: "12px" }}
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 bg-[#E9E9EC] hover:bg-[#DEDEE2] text-[#333438] rounded-full text-xs font-bold cursor-pointer active:scale-95 transition-all"
                style={{ paddingLeft: "12px", paddingRight: "12px", paddingTop: "6px", paddingBottom: "6px" }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ED7D4B] hover:bg-[#EE5B1B] text-white font-semibold rounded-full active:scale-[0.98] transition-all duration-150 mt-2 flex items-center justify-center gap-2 cursor-pointer text-sm shadow-xs"
            style={{ paddingTop: "14px", paddingBottom: "14px" }}
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <span>Login as Admin</span>
            )}
          </button>
        </form>

        {/* Server Endpoint Hint */}
        <div className="mt-4 text-center text-[11px] text-[#6B6B70] font-medium" suppressHydrationWarning>
          Server: {API_BASE_URL}
        </div>
      </div>
    </main>
  );
}
