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
      <div className="min-h-screen w-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <svg className="animate-spin h-8 w-8 text-[#ED7D4B]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-[#77777D] text-[14px] font-geist">Syncing Portal...</span>
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
    // Expo: bg-white screen, px-5 (20px), top 18 / bottom 36. Web caps content width and scales padding up.
    <div className="min-h-screen bg-white text-[#111111] font-sans pb-9 md:pb-12">
      <header className="max-w-[1200px] mx-auto flex flex-col gap-5 px-5 md:px-6 xl:px-8 pt-[18px] md:pt-6 xl:pt-8">
        {/* Header row — Expo: title text-[28px] geist-bold #141414; email text-[14px] #606066 */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-[28px] md:text-[32px] xl:text-[35px] font-bold text-[#141414]">Admin Panel</h1>
            <p className="text-[14px] md:text-[15px] xl:text-[17px] text-[#606066] mt-1 truncate">
              {user?.email || "tukebazrasoi04@gmail.com"}
            </p>
          </div>
          {/* Logout — Expo: h-11 rounded-full bg-[#ED7D4B] px-5, geist-semibold white */}
          <button
            onClick={handleLogout}
            className="shrink-0 h-11 md:h-12 xl:h-14 px-5 md:px-6 xl:px-8 bg-[#ED7D4B] hover:bg-[#EE5B1B] text-white rounded-full font-semibold transition-all active:opacity-85 cursor-pointer text-[14px] md:text-[15px] xl:text-[17px]"
          >
            Logout
          </button>
        </div>

        {/* Tab bar — Expo: rounded-full bg-[#F2F2F3] p-1, equal flex-1 tabs; active #111111, inactive #6C6C6E.
            Width capped on web so the segmented control keeps mobile-like proportions. */}
        <div className="flex w-full max-w-[560px] md:max-w-[680px] rounded-full bg-[#F2F2F3] p-1">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative flex-1 h-11 md:h-12 xl:h-14 flex items-center justify-center rounded-full text-[13px] md:text-[14px] xl:text-[16px] font-semibold transition-all cursor-pointer"
                style={{
                  backgroundColor: isActive ? "#111111" : "transparent",
                  color: isActive ? "#FFFFFF" : "#6C6C6E",
                }}
              >
                <span className="relative">
                  {link.label}
                  {link.label === "Partners" && pendingPartnersCount > 0 && (
                    <span className="absolute -top-1.5 -right-5 bg-[#F04646] text-white text-[9px] md:text-[10px] xl:text-[11px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border border-white px-1">
                      {pendingPartnersCount}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Content viewport — Expo content top gap mt-5; web ~mt-8 scaled */}
      <main className="max-w-[1200px] mx-auto px-5 md:px-6 xl:px-8 mt-8 md:mt-9 xl:mt-10">
        {children}
      </main>
    </div>
  );
}
