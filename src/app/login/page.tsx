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
    // Expo screen is bg-white px-5 py-6; web centers the card. Container scales 1.25x by xl.
    <main className="min-h-screen w-screen flex items-center justify-center bg-white px-5 py-6">
      {/* Card — Expo: rounded-[24px] bg-[#F7F7F8] p-5, flat (no border/shadow) */}
      <div className="w-full max-w-[420px] md:max-w-[460px] xl:max-w-[520px] bg-[#F7F7F8] rounded-[24px] md:rounded-[28px] xl:rounded-[32px] p-5 md:p-6 xl:p-8 animate-fade-in">
        {/* Header — title text-[28px] font-geist-bold #141414 */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-[28px] md:text-[32px] xl:text-[35px] font-bold text-[#141414]">Admin Login</h1>
        </div>

        {/* Session Expired — no Expo equivalent; styled with the Expo PENDING tokens */}
        {sessionExpired && (
          <div className="mb-4 rounded-2xl bg-[#FFF4D8] px-4 py-3 text-[#9A6200] animate-fade-in flex flex-col gap-0.5">
            <span className="text-[14px] md:text-[15px] xl:text-[17px] font-bold">Session Expired</span>
            <span className="text-[12px] md:text-[13px] xl:text-[15px] leading-5">Your connection expired due to inactivity. Please sign in again.</span>
          </div>
        )}

        {/* Error — Expo shows centered red text in the FAILED palette */}
        {error && (
          <p className="mb-4 text-center text-[14px] md:text-[15px] xl:text-[17px] text-[#9A1223] animate-fade-in">{error}</p>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[14px] md:text-[15px] xl:text-[17px] text-[#55555A]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="w-full bg-white border border-[#DDDEE2] rounded-xl xl:rounded-[14px] text-[14px] md:text-[15px] xl:text-[17px] text-[#111111] input-glow placeholder:text-[#9A9AA0] px-4 md:px-5 py-3 md:py-3.5"
              placeholder="admin@yourdomain.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[14px] md:text-[15px] xl:text-[17px] text-[#55555A]" htmlFor="password">
              Password
            </label>
            {/* Expo wraps input + Show button in a single bordered row */}
            <div className="flex items-center bg-white border border-[#DDDEE2] rounded-xl xl:rounded-[14px] px-4 md:px-5 input-glow-within">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                className="flex-1 bg-transparent text-[14px] md:text-[15px] xl:text-[17px] text-[#111111] placeholder:text-[#9A9AA0] py-3 md:py-3.5 outline-none"
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
                className="shrink-0 bg-[#E9E9EC] hover:bg-[#DEDEE2] text-[#333338] rounded-full text-[12px] md:text-[13px] xl:text-[15px] font-semibold cursor-pointer active:scale-95 transition-all px-3 py-1.5"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Primary button — Expo: h-12 rounded-full bg-[#ED7D4B], text-[15px] font-geist-semibold */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 md:h-12 xl:h-14 bg-[#ED7D4B] hover:bg-[#EE5B1B] text-white font-semibold rounded-full active:opacity-85 transition-all duration-150 mt-2 flex items-center justify-center cursor-pointer text-[15px] md:text-[16px] xl:text-[19px]"
          >
            {loading ? <span>Signing in...</span> : <span>Login as Admin</span>}
          </button>
        </form>

        {/* Server Endpoint Hint — Expo: text-[11px] #6B6B70 centered */}
        <div className="mt-3 text-center text-[11px] md:text-[12px] xl:text-[14px] text-[#6B6B70]" suppressHydrationWarning>
          Server: {API_BASE_URL}
        </div>
      </div>
    </main>
  );
}
