"use client";

import React, { useEffect, useState } from "react";
import { api, AnalyticsResponse, Booking, DeliveryOrder } from "@/lib/api";
import { GlobalCache } from "@/lib/cache";
import { RefreshCw } from "lucide-react";

type AnalyticsPeriod = "all" | "day" | "week" | "month";
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

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  SUCCESS: { bg: "#E5F4E3", text: "#1F7A1F" },
  PENDING: { bg: "#FFF3E0", text: "#E65100" },
  FAILED: { bg: "#FDECEA", text: "#B71C1C" },
};

export default function AnalyticsPage() {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>(GlobalCache.analyticsTx || []);
  const [loading, setLoading] = useState(!GlobalCache.analyticsTx);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const fetchData = async (showPulse = !GlobalCache.analyticsTx) => {
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
        quantity: 1, // Treat order as 1 unit
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        bookedFor: o.createdAt,
        user: { name: o.user?.name || "Customer", email: o.user?.email || "No Email" }
      }));

      GlobalCache.analyticsTx = [...unifiedBookings, ...unifiedOrders];
      setTransactions(GlobalCache.analyticsTx);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics data.");
    } finally {
      if (showPulse) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-8 w-40 bg-gray-200 rounded" />
          <div className="h-9 w-28 bg-gray-200 rounded" />
        </div>
        <div className="h-12 w-64 bg-gray-200 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-[24px]" />
          ))}
        </div>
        <div className="h-40 bg-gray-200 rounded-[24px] mt-5" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-[24px] p-6 text-center max-w-md mx-auto my-10">
        <p className="text-red-700 font-semibold">{error}</p>
        <button
          onClick={() => fetchData()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-full text-sm font-semibold active:scale-95 transition-all"
        >
          Retry Sync
        </button>
      </div>
    );
  }

  const periodFiltered = transactions.filter((t) => isWithinPeriod(t.createdAt, period));
  const filteredTransactions = periodFiltered.filter(t => statusFilter === "all" ? true : t.paymentStatus === statusFilter);

  // Compute stats based on period filtered (independent of status filter for high-level numbers, or dependent? Usually high-level numbers shouldn't change when you toggle table filter. Let's use periodFiltered for totals)
  const totalTransactions = periodFiltered.length;
  const successfulTx = periodFiltered.filter((t) => t.paymentStatus === "SUCCESS");
  const successfulCount = successfulTx.length;
  const roomsPurchased = successfulTx.filter((t) => t.type === "ROOM").length;
  const servicesPurchased = successfulTx.filter((t) => t.type === "SERVICE").length;
  const foodPurchased = successfulTx.filter((t) => t.type === "FOOD_GROCERY").length;

  const totalRevenue = successfulTx.reduce((sum, t) => sum + (t.amount || 0), 0);

  // Group top items by revenue
  const itemRevenueMap: Record<string, { name: string; revenue: number; count: number; kind: string }> = {};
  successfulTx.forEach((t) => {
    // For food, group by type, for rooms group by title
    const itemId = t.type === "FOOD_GROCERY" ? "food_delivery" : t.title;
    const itemName = t.type === "FOOD_GROCERY" ? "Delivery Orders" : t.title;
    
    if (!itemRevenueMap[itemId]) {
      itemRevenueMap[itemId] = { name: itemName, revenue: 0, count: 0, kind: t.type };
    }
    itemRevenueMap[itemId].revenue += t.amount || 0;
    itemRevenueMap[itemId].count += t.quantity || 1;
  });

  const revenueGraphRows = Object.values(itemRevenueMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const maxRevenue = revenueGraphRows.length > 0 ? Math.max(...revenueGraphRows.map((r) => r.revenue)) : 0;

  // Latest sorted transactions for selected period and status
  const latestBookings = [...filteredTransactions]
    .filter(t => t.type === "ROOM" || t.type === "SERVICE")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  const latestOrders = [...filteredTransactions]
    .filter(t => t.type === "FOOD_GROCERY")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-[#111111] tracking-tight">Analytics</h2>
        </div>
        <button
          onClick={() => fetchData()}
          className="flex items-center gap-2 bg-[#111111] hover:bg-black text-white px-5 py-2.5 rounded-full text-xs font-semibold active:scale-95 transition-all cursor-pointer"
          style={{ paddingLeft: "20px", paddingRight: "20px", paddingTop: "10px", paddingBottom: "10px" }}
        >
          <RefreshCw size={12} />
          <span>Sync Data</span>
        </button>
      </header>

      {/* Filters Container */}
      <div className="flex flex-col sm:flex-row gap-4">
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
        
        <div className="hidden sm:block w-px bg-[#EBEBEF] mx-1"></div>
        
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
              {s === "all" ? "All Status" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards - Responsive 2x2 on Mobile, 5x1 on PC/iPad */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
        <div 
          className="bg-white rounded-[24px] p-5 border border-[#EBEBEF] shadow-xs flex flex-col justify-between min-h-[110px]"
          style={{ padding: "24px", minHeight: "120px" }}
        >
          <p className="text-xs font-bold text-[#66666A] tracking-wider uppercase">Total Transactions</p>
          <p className="text-3xl font-extrabold text-[#111111] mt-2">{totalTransactions}</p>
        </div>
        <div 
          className="bg-white rounded-[24px] p-5 border border-[#EBEBEF] shadow-xs flex flex-col justify-between min-h-[110px]"
          style={{ padding: "24px", minHeight: "120px" }}
        >
          <p className="text-xs font-bold text-[#66666A] tracking-wider uppercase">Successful</p>
          <p className="text-3xl font-extrabold text-[#111111] mt-2">{successfulCount}</p>
        </div>
        <div 
          className="bg-white rounded-[24px] p-5 border border-[#EBEBEF] shadow-xs flex flex-col justify-between min-h-[110px]"
          style={{ padding: "24px", minHeight: "120px" }}
        >
          <p className="text-xs font-bold text-[#66666A] tracking-wider uppercase">Rooms Purchased</p>
          <p className="text-3xl font-extrabold text-[#111111] mt-2">{roomsPurchased}</p>
        </div>
        <div 
          className="bg-white rounded-[24px] p-5 border border-[#EBEBEF] shadow-xs flex flex-col justify-between min-h-[110px]"
          style={{ padding: "24px", minHeight: "120px" }}
        >
          <p className="text-xs font-bold text-[#66666A] tracking-wider uppercase">Services Purchased</p>
          <p className="text-3xl font-extrabold text-[#111111] mt-2">{servicesPurchased}</p>
        </div>
        <div 
          className="bg-white rounded-[24px] p-5 border border-[#EBEBEF] shadow-xs flex flex-col justify-between min-h-[110px]"
          style={{ padding: "24px", minHeight: "120px" }}
        >
          <p className="text-xs font-bold text-[#66666A] tracking-wider uppercase">Food/Grocery</p>
          <p className="text-3xl font-extrabold text-[#111111] mt-2">{foodPurchased}</p>
        </div>
      </div>

      {/* Revenue Total */}
      <p className="text-base font-bold text-[#111111] mt-4">
        Revenue: INR {totalRevenue.toLocaleString("en-IN")}
      </p>

      {/* Revenue Graph */}
      <div 
        className="bg-white rounded-[24px] p-6 mt-4 border border-[#EBEBEF] shadow-xs"
        style={{ padding: "28px" }}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-[#111111]">Revenue Graph</h3>
            <p className="text-xs text-[#66666A] mt-0.5">Top items for selected period</p>
          </div>
          <span className="text-xs font-bold text-[#66666A]">INR</span>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {revenueGraphRows.length > 0 ? (
            revenueGraphRows.map((row, index) => {
              const barWidth = maxRevenue > 0 ? Math.max(8, Math.round((row.revenue / maxRevenue) * 100)) : 8;
              let barColor = "#111111"; // Default/Service
              if (row.kind === "ROOM") barColor = "#ED7D4B";
              if (row.kind === "FOOD_GROCERY") barColor = "#22C55E";

              return (
                <div key={index} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#33343A] truncate max-w-[60%]">{row.name}</span>
                    <span className="text-[#111111]">
                      INR {row.revenue.toLocaleString("en-IN")} | Qty {row.count}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-[#F2F2F3] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-[#66666A] italic py-8 text-center">
              Graph will appear after successful purchases.
            </p>
          )}
        </div>
      </div>

      {/* Latest Activity Sections */}
      <div className="mt-6 flex flex-col xl:flex-row gap-6">
        
        {/* Bookings */}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-[#111111] mb-3">Latest Bookings</h3>
          <div className="flex flex-col gap-4">
            {latestBookings.length > 0 ? (
              latestBookings.map((tx) => {
                const statusStyle = STATUS_STYLES[tx.paymentStatus] || { bg: "#F2F2F3", text: "#33343A" };
                return (
                  <div 
                    key={tx.id} 
                    className="bg-white rounded-[24px] p-5 border border-[#EBEBEF] shadow-xs flex flex-col justify-between"
                    style={{ padding: "20px" }}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="text-base font-bold text-[#111111]">{tx.title}</h4>
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.text, paddingLeft: "10px", paddingRight: "10px", paddingTop: "4px", paddingBottom: "4px" }}
                        >
                          {tx.paymentStatus}
                        </span>
                      </div>
                      <p className="text-xs text-[#66666A] mt-1.5 leading-relaxed">
                        User: {tx.user.name} | {tx.user.email}
                      </p>
                      <p className="text-xs text-[#66666A] mt-1">
                        Date: {formatDate(tx.bookedFor)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#EBEBEF]">
                      <span className="text-xs font-bold text-[#66666A]">
                        INR {tx.amount?.toLocaleString("en-IN")} | Qty {tx.quantity || 1}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[#66666A] italic py-4">No bookings for this period/filter.</p>
            )}
          </div>
        </div>

        {/* Delivery Orders */}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-[#111111] mb-3">Latest Delivery Orders</h3>
          <div className="flex flex-col gap-4">
            {latestOrders.length > 0 ? (
              latestOrders.map((tx) => {
                const statusStyle = STATUS_STYLES[tx.paymentStatus] || { bg: "#F2F2F3", text: "#33343A" };
                return (
                  <div 
                    key={tx.id} 
                    className="bg-white rounded-[24px] p-5 border border-[#EBEBEF] shadow-xs flex flex-col justify-between"
                    style={{ padding: "20px" }}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="text-base font-bold text-[#111111]">{tx.title}</h4>
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.text, paddingLeft: "10px", paddingRight: "10px", paddingTop: "4px", paddingBottom: "4px" }}
                        >
                          {tx.paymentStatus}
                        </span>
                      </div>
                      <p className="text-xs text-[#66666A] mt-1.5 leading-relaxed">
                        User: {tx.user.name} | {tx.user.email}
                      </p>
                      <p className="text-xs text-[#66666A] mt-1">
                        Placed: {formatDateTime(tx.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#EBEBEF]">
                      <span className="text-xs font-bold text-[#66666A]">
                        INR {tx.amount?.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[#66666A] italic py-4">No delivery orders for this period/filter.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
