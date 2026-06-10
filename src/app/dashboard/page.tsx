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

// Status palette — exact values from the Expo app's STATUS_STYLES (AdminDashboardScreen).
const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  SUCCESS: { bg: "#E8F8EE", text: "#156D35" },
  PENDING: { bg: "#FFF4D8", text: "#9A6200" },
  FAILED: { bg: "#FFE8EB", text: "#9A1223" },
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
      <div className="bg-[#FFE8EB] rounded-[24px] p-6 text-center max-w-md mx-auto my-10">
        <p className="text-[#9A1223] font-semibold text-[14px] md:text-[15px] xl:text-[17px]">{error}</p>
        <button
          onClick={() => fetchData()}
          className="mt-4 px-5 py-2.5 bg-[#ED7D4B] hover:bg-[#EE5B1B] text-white rounded-full text-[13px] md:text-[14px] xl:text-[16px] font-semibold active:opacity-85 transition-all"
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

  // Bar color by category — Expo accents: ROOM #ED7D4B, SERVICE #111111, FOOD #22C55E
  const barColorFor = (kind: string) =>
    kind === "ROOM" ? "#ED7D4B" : kind === "FOOD_GROCERY" ? "#22C55E" : "#111111";

  return (
    // Expo wraps analytics in a single flat panel: rounded-[24px] bg-[#F7F7F8] p-5
    <div className="rounded-[24px] md:rounded-[28px] xl:rounded-[32px] bg-[#F7F7F8] p-5 md:p-6 xl:p-8 animate-fade-in">
      <div className="flex justify-between items-center">
        {/* Section title — Expo: text-[20px] geist-semibold #171717 */}
        <h2 className="text-[20px] md:text-[22px] xl:text-[25px] font-semibold text-[#171717]">Analytics</h2>
        {/* Sync — web addition, built from dark-pill tokens */}
        <button
          onClick={() => fetchData()}
          className="flex items-center gap-2 bg-[#111111] hover:bg-black text-white px-4 md:px-5 py-2.5 rounded-full text-[12px] md:text-[13px] xl:text-[15px] font-semibold active:scale-95 transition-all cursor-pointer"
        >
          <RefreshCw size={14} />
          <span>Sync Data</span>
        </button>
      </div>

      {/* Filter pill groups — Expo: rounded-full bg-[#E9E9EC] p-1; pills px-4 py-1.5 text-[12px]; inactive #33343A */}
      <div className="mt-3 flex flex-row flex-wrap gap-2.5">
        <div className="flex rounded-full bg-[#E9E9EC] p-1">
          {(["all", "day", "week", "month"] as AnalyticsPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="rounded-full px-4 md:px-5 py-1.5 md:py-2 text-[12px] md:text-[13px] xl:text-[15px] font-semibold capitalize transition-all cursor-pointer"
              style={{
                backgroundColor: period === p ? "#111111" : "transparent",
                color: period === p ? "#FFFFFF" : "#33343A",
              }}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex rounded-full bg-[#E9E9EC] p-1">
          {(["all", "SUCCESS", "FAILED"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="rounded-full px-4 md:px-5 py-1.5 md:py-2 text-[12px] md:text-[13px] xl:text-[15px] font-semibold capitalize transition-all cursor-pointer"
              style={{
                backgroundColor: statusFilter === s ? "#111111" : "transparent",
                color: statusFilter === s ? "#FFFFFF" : "#33343A",
              }}
            >
              {s === "all" ? "All Status" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards — Expo: rounded-2xl bg-white p-4; label text-[11px] geist-bold uppercase #77777D; value text-[26px] */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 md:gap-3 xl:gap-4 mt-4">
        {[
          { label: "Total Transactions", value: totalTransactions },
          { label: "Successful", value: successfulCount },
          { label: "Rooms Purchased", value: roomsPurchased },
          { label: "Services Purchased", value: servicesPurchased },
          { label: "Food/Grocery", value: foodPurchased },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl md:rounded-[20px] xl:rounded-[24px] p-4 md:p-5 xl:p-6">
            <p className="text-[11px] md:text-[12px] xl:text-[14px] font-bold text-[#77777D] tracking-wider uppercase">{m.label}</p>
            <p className="text-[26px] md:text-[30px] xl:text-[33px] font-bold text-[#111111] mt-2">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue total — Expo: text-[16px] geist-semibold #171717 */}
      <p className="text-[16px] md:text-[18px] xl:text-[20px] font-semibold text-[#171717] mt-4">
        Revenue: INR {totalRevenue.toLocaleString("en-IN")}
      </p>

      {/* Revenue graph card — Expo: rounded-2xl bg-white p-4 */}
      <div className="bg-white rounded-2xl md:rounded-[20px] xl:rounded-[24px] p-4 md:p-5 xl:p-6 mt-5">
        <div className="flex justify-between items-start">
          <div className="pr-3">
            <h3 className="text-[18px] md:text-[20px] xl:text-[22px] font-semibold text-[#171717]">Revenue Graph</h3>
            <p className="text-[13px] md:text-[14px] xl:text-[16px] text-[#6A6A70] mt-1">Top items for selected period</p>
          </div>
          <span className="text-[12px] md:text-[13px] xl:text-[15px] font-semibold text-[#5F6064]">INR</span>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {revenueGraphRows.length > 0 ? (
            revenueGraphRows.map((row, index) => {
              const barWidth = maxRevenue > 0 ? Math.max(8, Math.round((row.revenue / maxRevenue) * 100)) : 8;
              return (
                <div key={index} className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-[12px] md:text-[13px] xl:text-[15px] font-semibold text-[#303036] truncate max-w-[60%]">{row.name}</span>
                    <span className="text-[12px] md:text-[13px] xl:text-[15px] text-[#66666C]">
                      INR {row.revenue.toLocaleString("en-IN")} | {row.count}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-[#E9E9EC] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%`, backgroundColor: barColorFor(row.kind) }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-[14px] md:text-[15px] xl:text-[17px] text-[#646468] py-4">
              Graph will appear after successful purchases.
            </p>
          )}
        </div>
      </div>

      {/* Latest activity — Expo: text-[18px] geist-semibold #171717, cards rounded-2xl bg-white p-4 */}
      <div className="mt-5 flex flex-col xl:flex-row gap-5 xl:gap-6">
        {[
          { heading: "Latest Bookings", rows: latestBookings, dateLabel: "Date", dateOf: (t: UnifiedTransaction) => formatDate(t.bookedFor), showQty: true, empty: "No bookings for this period/filter." },
          { heading: "Latest Delivery Orders", rows: latestOrders, dateLabel: "Placed", dateOf: (t: UnifiedTransaction) => formatDateTime(t.createdAt), showQty: false, empty: "No delivery orders for this period/filter." },
        ].map((col) => (
          <div key={col.heading} className="flex-1">
            <h3 className="text-[18px] md:text-[20px] xl:text-[22px] font-semibold text-[#171717] mb-3">{col.heading}</h3>
            <div className="flex flex-col gap-3">
              {col.rows.length > 0 ? (
                col.rows.map((tx) => {
                  const statusStyle = STATUS_STYLES[tx.paymentStatus] || { bg: "#F2F2F3", text: "#33343A" };
                  return (
                    <div key={tx.id} className="bg-white rounded-2xl md:rounded-[20px] xl:rounded-[24px] p-4 md:p-5 xl:p-6">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-[15px] md:text-[16px] xl:text-[19px] font-semibold text-[#131313]">{tx.title}</h4>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] md:text-[12px] xl:text-[14px] font-bold"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                        >
                          {tx.paymentStatus}
                        </span>
                      </div>
                      <p className="text-[12px] md:text-[13px] xl:text-[15px] text-[#5F6064] mt-1 leading-5">
                        User: {tx.user.name} | {tx.user.email}
                      </p>
                      <p className="text-[12px] md:text-[13px] xl:text-[15px] text-[#5F6064] mt-1">
                        {col.dateLabel}: {col.dateOf(tx)}
                      </p>
                      <p className="text-[12px] md:text-[13px] xl:text-[15px] text-[#5F6064] mt-2">
                        INR {tx.amount?.toLocaleString("en-IN")}{col.showQty ? ` | Qty ${tx.quantity || 1}` : ""}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-[14px] md:text-[15px] xl:text-[17px] text-[#646468] py-2">{col.empty}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
