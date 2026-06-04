"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getAdminToken, getAdminUser, removeAdminToken, User, api } from "@/lib/api";
import { GlobalCache } from "@/lib/cache";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [pendingPartnersCount, setPendingPartnersCount] = useState(0);

  useEffect(() => {
    const token = getAdminToken();
    const admin = getAdminUser();

    if (!token) {
      router.push("/login");
    } else {
      setUser(admin);
      setAuthenticated(true);

      // Global Data Prefetching to populate cache for all tabs instantly
      if (!GlobalCache.preloaded) {
        GlobalCache.preloaded = true;

        // 1. Partners & Payouts Preload (needed for navigation badge)
        Promise.all([
          api.getPendingPartners().catch(() => []),
          api.adminGetAllPartners().catch(() => []),
          api.getPendingPayoutRequests().catch(() => []),
        ]).then(([pending, all, payouts]) => {
          GlobalCache.partnersPending = pending || [];
          GlobalCache.partnersAll = all || [];
          GlobalCache.partnersPayouts = payouts || [];
          const totalCount = (pending || []).length + (payouts || []).length;
          setPendingPartnersCount(totalCount);
        });
      } else {
        // Just update badge if already preloaded
        const totalCount = (GlobalCache.partnersPending || []).length + (GlobalCache.partnersPayouts || []).length;
        setPendingPartnersCount(totalCount);
      }
    }
  }, [router, pathname]);

  // Synchronize badge count from GlobalCache changes dynamically (e.g. on verification/payout clearance)
  useEffect(() => {
    const syncCount = () => {
      const pendingCount = (GlobalCache.partnersPending || []).length;
      const payoutsCount = (GlobalCache.partnersPayouts || []).length;
      setPendingPartnersCount(pendingCount + payoutsCount);
    };
    const interval = setInterval(syncCount, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    removeAdminToken();
    router.push("/login");
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen w-screen bg-[#ECECEE] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <svg className="animate-spin h-8 w-8 text-[#ED7D4B]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-[#6C6C70] text-sm font-medium tracking-wide">Syncing Portal...</span>
        </div>
      </div>
    );
  }

  const navLinks = [
    { href: "/dashboard", label: "Analytics" },
    { href: "/dashboard/catalog", label: "Catalog" },
    { href: "/dashboard/ledger", label: "Purchases" },
    { href: "/dashboard/partners", label: "Partners" },
  ];

  return (
    <div className="min-h-screen bg-[#ECECEE] text-[#111111] font-sans pb-16">
      {/* Header matching Mobile UI with inline style fallback */}
      <header
        className="max-w-[1200px] mx-auto flex flex-col gap-4"
        style={{ paddingLeft: "24px", paddingRight: "24px", paddingTop: "24px" }}
      >
        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#111111] tracking-tight">Admin Panel</h1>
            <p className="text-sm text-[#66666A] mt-1 font-medium">
              {user?.email || "tukebazrasoi04@gmail.com"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-[#ED7D4B] hover:bg-[#EE5B1B] text-white rounded-full font-semibold transition-all active:scale-95 cursor-pointer shadow-sm"
            style={{ paddingLeft: "24px", paddingRight: "24px", paddingTop: "10px", paddingBottom: "10px" }}
          >
            Logout
          </button>
        </div>

        {/* Tab Switcher Navigation Bar */}
        <div
          className="flex rounded-full bg-white border border-[#EBEBEF] shadow-sm self-start  whitespace-nowrap max-w-full scrollbar-none gap-1 mt-2"
          style={{ padding: "6px" }}
        >
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative overflow-visible rounded-full text-sm font-semibold transition-all cursor-pointer h-11 flex items-center justify-center gap-2`}
                style={{
                  paddingLeft: "24px",
                  paddingRight: "24px",
                  backgroundColor: isActive ? "#111111" : "transparent",
                  color: isActive ? "#FFFFFF" : "#66666A",
                }}
              >
                <span>{link.label}</span>
                {link.label === "Partners" && pendingPartnersCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#F04646] text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center lg:border-2 border border-white shadow-sm px-1.5">
                    {pendingPartnersCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Responsive viewport */}
      <main
        className="max-w-[1200px] mx-auto"
        style={{ paddingLeft: "24px", paddingRight: "24px", marginTop: "32px" }}
      >
        {children}
      </main>
    </div>
  );
}
