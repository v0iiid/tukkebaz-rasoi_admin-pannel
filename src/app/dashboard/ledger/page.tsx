"use client";

import React, { useEffect, useState } from "react";
import { api, AnalyticsResponse, Booking, DeliveryOrder } from "@/lib/api";
import { GlobalCache } from "@/lib/cache";
import { RefreshCw } from "lucide-react";

type AnalyticsPeriod = "all" | "day" | "week" | "month";
type PurchaseSort = "latest" | "bookingDate" | "amount";
type StatusFilter = "all" | "SUCCESS" | "FAILED";

type UnifiedTransaction = {
  id: string;
  type: "ROOM" | "SERVICE" | "FOOD_GROCERY";
  title: string;
  amount: number;
  quantity: number;
  paymentStatus: "PENDING" | "SUCCESS" | "FAILED";
  createdAt: string;
  bookedFor?: string | null;
  user: { name: string; email: string };
};

const formatDate = (value?: string | null): string => {
  if (!value) return "Not selected";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  SUCCESS: { bg: "#E5F4E3", text: "#1F7A1F" },
  PENDING: { bg: "#FFF3E0", text: "#E65100" },
  FAILED: { bg: "#FDECEA", text: "#B71C1C" },
};

const isWithinPeriod = (value: string | null | undefined, period: AnalyticsPeriod): boolean => {
  if (period === "all") return true;
  if (!value) return false;
  const date = new Date(value);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  const start = new Date(now);
  if (period === "day") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return date >= start && date <= now;
};

export default function PurchasesPage() {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>(GlobalCache.ledgerTx || []);
  const [loading, setLoading] = useState(!GlobalCache.ledgerTx);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>("all");
  const [sortOption, setSortOption] = useState<PurchaseSort>("latest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [listCategory, setListCategory] = useState<"BOOKINGS" | "DELIVERY">("BOOKINGS");

  const fetchPurchases = async (showPulse = !GlobalCache.ledgerTx) => {
    try {
      if (showPulse) setLoading(true);
      setError(null);
      const [analyticsRes, ordersRes] = await Promise.all([
        api.getAnalytics().catch(() => ({ recentBookings: [] })),
        api.getKitchenOrders().catch(() => [])
      ]);

      const allBookings: Booking[] = (analyticsRes as AnalyticsResponse).recentBookings || [];
      const allOrders: DeliveryOrder[] = (ordersRes as DeliveryOrder[]) || [];

      const unifiedBookings: UnifiedTransaction[] = allBookings.map(b => ({
        id: b.id,
        type: b.kind,
        title: b.room?.title || b.service?.title || b.kind,
        amount: b.amount || 0,
        quantity: b.quantity || 1,
        paymentStatus: b.paymentStatus,
        createdAt: b.createdAt,
        bookedFor: b.bookedFor,
        user: { name: b.user?.name || "Customer", email: b.user?.email || "No Email" }
      }));

      const unifiedOrders: UnifiedTransaction[] = allOrders.map(o => ({
        id: o.id,
        type: "FOOD_GROCERY",
        title: `Order #${o.orderNumber}`,
        amount: o.totalAmount || 0,
        quantity: 1,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        bookedFor: o.createdAt,
        user: { name: o.user?.name || "Customer", email: o.user?.email || "No Email" }
      }));

      GlobalCache.ledgerTx = [...unifiedBookings, ...unifiedOrders];
      setTransactions(GlobalCache.ledgerTx);
    } catch (err: any) {
      setError(err.message || "Failed to load purchases data.");
    } finally {
      if (showPulse) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const categoryFiltered = transactions.filter((t) => {
    if (listCategory === "BOOKINGS") return t.type === "ROOM" || t.type === "SERVICE";
    if (listCategory === "DELIVERY") return t.type === "FOOD_GROCERY";
    return true;
  });
  const periodFiltered = categoryFiltered.filter((t) => isWithinPeriod(t.createdAt, period));
  const filteredTransactions = periodFiltered.filter(t => statusFilter === "all" ? true : t.paymentStatus === statusFilter);

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (sortOption === "latest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortOption === "bookingDate") {
      const dateA = a.bookedFor ? new Date(a.bookedFor).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.bookedFor ? new Date(b.bookedFor).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    } else if (sortOption === "amount") {
      return (b.amount || 0) - (a.amount || 0);
    }
    return 0;
  });

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-8 w-40 bg-gray-200 rounded" />
          <div className="h-9 w-28 bg-gray-200 rounded" />
        </div>
        <div className="h-16 w-full bg-gray-200 rounded-[28px]" />
        <div className="h-96 w-full bg-gray-200 rounded-[28px] mt-4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-[24px] p-6 text-center max-w-md mx-auto my-10 animate-fade-in">
        <p className="text-red-700 font-semibold">{error}</p>
        <button
          onClick={fetchPurchases}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-full text-sm font-semibold active:scale-95 transition-all"
        >
          Retry Sync
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#111111] tracking-tight">Premium Purchase Ledger</h2>
          <p className="text-xs text-[#66666A] mt-1 font-medium">Guest, booking date, payment status, and revenue details.</p>
        </div>
        <button
          onClick={fetchPurchases}
          className="flex items-center gap-2 bg-[#111111] hover:bg-black text-white px-5 py-2.5 rounded-full text-xs font-semibold active:scale-95 transition-all cursor-pointer shadow-xs"
          style={{ paddingLeft: "20px", paddingRight: "20px", paddingTop: "10px", paddingBottom: "10px" }}
        >
          <RefreshCw size={12} />
          <span>Sync Ledger</span>
        </button>
      </header>

      {/* Category Tabs */}
      <div 
        className="flex rounded-full bg-white border border-[#EBEBEF] shadow-sm self-start p-1"
      >
        <button
          onClick={() => setListCategory("BOOKINGS")}
          className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
            listCategory === "BOOKINGS" ? "bg-[#111111] text-white shadow-sm" : "text-[#66666A] hover:text-[#111111]"
          }`}
        >
          Bookings
        </button>
        <button
          onClick={() => setListCategory("DELIVERY")}
          className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
            listCategory === "DELIVERY" ? "bg-[#111111] text-white shadow-sm" : "text-[#66666A] hover:text-[#111111]"
          }`}
        >
          Food & Grocery
        </button>
      </div>

      <div 
        className="rounded-[28px] bg-white p-5 border border-[#EBEBEF] shadow-xs flex flex-col sm:flex-row gap-6"
        style={{ padding: "24px" }}
      >
        <div className="flex flex-col gap-4 w-full">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8 flex-wrap">
            <div>
              <span className="text-[10px] font-bold text-[#8D8D93] uppercase tracking-wider block mb-2">Period</span>
              <div className="flex gap-1 bg-white border border-[#EBEBEF] rounded-full shadow-sm p-1">
                {(["all", "day", "week", "month"] as AnalyticsPeriod[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-all cursor-pointer ${
                      period === p ? "bg-[#111111] text-white" : "text-[#66666A] hover:text-[#111111] hover:bg-gray-50"
                    }`}
                    style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px" }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden lg:block w-px h-10 bg-[#EBEBEF]"></div>

            <div>
              <span className="text-[10px] font-bold text-[#8D8D93] uppercase tracking-wider block mb-2">Status</span>
              <div className="flex gap-1 bg-white border border-[#EBEBEF] rounded-full shadow-sm p-1">
                {(["all", "SUCCESS", "FAILED"] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-all cursor-pointer ${
                      statusFilter === s ? "bg-[#111111] text-white" : "text-[#66666A] hover:text-[#111111] hover:bg-gray-50"
                    }`}
                    style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px" }}
                  >
                    {s === "all" ? "All" : s}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="hidden lg:block w-px h-10 bg-[#EBEBEF]"></div>

            <div>
              <span className="text-[10px] font-bold text-[#8D8D93] uppercase tracking-wider block mb-2">Sort by</span>
              <div className="flex gap-1 bg-white border border-[#EBEBEF] rounded-full shadow-sm p-1">
                {(["latest", "bookingDate", "amount"] as PurchaseSort[]).map((opt) => {
                  const active = sortOption === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setSortOption(opt)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                        active ? "bg-[#ED7D4B] text-white shadow-sm" : "text-[#66666A] hover:text-[#111111] hover:bg-gray-50"
                      }`}
                      style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px" }}
                    >
                      {opt === "latest" ? "Latest" : opt === "bookingDate" ? "Booking Date" : "Amount"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {sortedTransactions.length > 0 ? (
          sortedTransactions.map((tx) => {
            const statusStyle = STATUS_STYLES[tx.paymentStatus] || { bg: "#F2F2F3", text: "#33343A" };
            
            let kindBadge = { bg: "#111111", text: "#FFFFFF", label: "Unknown" };
            if (tx.type === "ROOM") kindBadge = { bg: "#ED7D4B", text: "#FFFFFF", label: "ROOM" };
            if (tx.type === "SERVICE") kindBadge = { bg: "#2E7CF6", text: "#FFFFFF", label: "SERVICE" };
            if (tx.type === "FOOD_GROCERY") kindBadge = { bg: "#22C55E", text: "#FFFFFF", label: "DELIVERY" };

            return (
              <div 
                key={tx.id} 
                className="rounded-[28px] bg-white p-5 border border-[#EBEBEF] shadow-xs flex flex-col justify-between"
                style={{ padding: "28px" }}
              >
                <div>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-2 max-w-[70%]">
                      <span 
                        className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider shrink-0"
                        style={{ backgroundColor: kindBadge.bg, color: kindBadge.text }}
                      >
                        {kindBadge.label}
                      </span>
                      <h3 className="text-base font-bold text-[#111111] leading-snug truncate">{tx.title}</h3>
                    </div>
                    <span 
                      className="rounded-lg bg-[#FFF3E0] text-[#E65100] px-3 py-1.5 text-xs font-bold shrink-0"
                      style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px" }}
                    >
                      INR {tx.amount?.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="text-xs text-[#66666A] mt-2 font-medium">
                    User: {tx.user.name}
                  </p>
                  <p className="text-xs text-[#8D8D93] mt-0.5 font-medium leading-relaxed truncate">
                    {tx.user.email}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div 
                      className="bg-[#F2F2F3] rounded-xl p-3 border border-[#EBEBEF]"
                      style={{ padding: "16px" }}
                    >
                      <span className="text-[10px] font-bold text-[#8D8D93] uppercase block">Booking date</span>
                      <span className="text-xs font-bold text-[#111111] mt-1 block">
                        {formatDate(tx.bookedFor)}
                      </span>
                    </div>
                    <div 
                      className="bg-[#F2F2F3] rounded-xl p-3 border border-[#EBEBEF]"
                      style={{ padding: "16px" }}
                    >
                      <span className="text-[10px] font-bold text-[#8D8D93] uppercase block">Purchased</span>
                      <span className="text-xs font-bold text-[#111111] mt-1 block leading-tight">
                        {formatDateTime(tx.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-5 pt-3 border-t border-[#EBEBEF]">
                  <span className="text-xs font-bold text-[#66666A]">
                    Qty {tx.quantity || 1}
                  </span>
                  <span
                    className="rounded-full px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase"
                    style={{ backgroundColor: statusStyle.bg, color: statusStyle.text, paddingLeft: "12px", paddingRight: "12px", paddingTop: "6px", paddingBottom: "6px" }}
                  >
                    {tx.paymentStatus}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-[#66666A] italic py-8 text-center col-span-2">No purchase records yet.</p>
        )}
      </div>
    </div>
  );
}
