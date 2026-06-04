"use client";

import React, { useEffect, useState } from "react";
import { api, DeliveryPartner, PartnerPayoutRequest } from "@/lib/api";
import { GlobalCache } from "@/lib/cache";
import { RefreshCw, CheckCircle2, Wallet, ExternalLink, ShieldAlert, BadgeCheck, BadgeAlert, Phone, MessageSquare, X } from "lucide-react";

export default function PartnersPage() {
  const [pendingPartners, setPendingPartners] = useState<DeliveryPartner[]>(GlobalCache.partnersPending || []);
  const [allPartners, setAllPartners] = useState<DeliveryPartner[]>(GlobalCache.partnersAll || []);
  const [payoutRequests, setPayoutRequests] = useState<PartnerPayoutRequest[]>(GlobalCache.partnersPayouts || []);
  const [loading, setLoading] = useState(!GlobalCache.partnersAll);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partnerFilter, setPartnerFilter] = useState<"ALL" | "APPROVED" | "INCOMPLETE" | "REJECTED">("ALL");

  const [selectedPayout, setSelectedPayout] = useState<PartnerPayoutRequest | null>(null);
  const [utrInput, setUtrInput] = useState("");
  const [decisionModal, setDecisionModal] = useState<{
    isOpen: boolean;
    partnerId: string;
    partnerName: string;
    action: "APPROVED" | "REJECTED" | null;
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({
    isOpen: false,
    partnerId: "",
    partnerName: "",
    action: null,
    status: "idle",
    message: "",
  });

  const loadData = async (showPulse = !GlobalCache.partnersAll) => {
    try {
      if (showPulse) setLoading(true);
      setError(null);
      const [pending, all, payouts] = await Promise.all([
        api.getPendingPartners().catch(() => []),
        api.adminGetAllPartners().catch(() => []),
        api.getPendingPayoutRequests().catch(() => []),
      ]);
      GlobalCache.partnersPending = pending || [];
      GlobalCache.partnersAll = all || [];
      GlobalCache.partnersPayouts = payouts || [];

      setPendingPartners(GlobalCache.partnersPending);
      setAllPartners(GlobalCache.partnersAll);
      setPayoutRequests(GlobalCache.partnersPayouts);
    } catch (err: any) {
      setError(err.message || "Failed to load partners data.");
    } finally {
      if (showPulse) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const submitPayout = async () => {
    if (!selectedPayout) return;
    const utr = utrInput.trim();
    if (!utr) {
      alert("UTR reference number is required to clear payout.");
      return;
    }
    if (!/^[A-Za-z0-9]{6,}$/.test(utr)) {
      alert("Please enter a valid UTR reference number (at least 6 alphanumeric characters).");
      return;
    }

    try {
      setClearingId(selectedPayout.id);
      await api.clearPartnerPayout(selectedPayout.id, utr);
      alert("Payout cleared and recorded successfully.");
      setSelectedPayout(null);
      setUtrInput("");
      loadData(false);
    } catch (err: any) {
      alert(err.message || "Failed to clear payout.");
    } finally {
      setClearingId(null);
    }
  };

  const openDecisionModal = (partnerId: string, name: string, action: "APPROVED" | "REJECTED") => {
    setDecisionModal({
      isOpen: true,
      partnerId,
      partnerName: name,
      action,
      status: "idle",
      message: "",
    });
  };

  const executeVerifyPartner = async () => {
    const { partnerId, action } = decisionModal;
    if (!partnerId || !action) return;

    setDecisionModal((prev) => ({ ...prev, status: "loading" }));
    setVerifyingId(partnerId);

    try {
      const res = await api.verifyPartner(partnerId, action);
      setDecisionModal((prev) => ({
        ...prev,
        status: "success",
        message: res.message || `Partner verified as ${action === "APPROVED" ? "Approved" : "Rejected"}.`,
      }));
      loadData(false);
      
      // Auto close after 1.5 seconds
      setTimeout(() => {
        setDecisionModal((prev) => ({ ...prev, isOpen: false }));
      }, 1500);
    } catch (err: any) {
      setDecisionModal((prev) => ({
        ...prev,
        status: "error",
        message: err.message || "Failed to update partner verification status.",
      }));
    } finally {
      setVerifyingId(null);
    }
  };

  const matchStatus = (status?: string | null, filter?: string) => {
    if (filter === "ALL") return true;
    if (!status) return filter === "INCOMPLETE";
    if (status === "NOT_SUBMITTED") return filter === "INCOMPLETE";
    return status === filter;
  };

  const filteredPartners = allPartners
    .filter((partner) => partner.profileStatus !== "PENDING")
    .filter((partner) => matchStatus(partner.profileStatus, partnerFilter));

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <header className="flex justify-between items-center">
          <div>
            <div className="h-8 w-64 bg-gray-200 rounded-lg" />
            <div className="h-4 w-96 bg-gray-100 rounded-lg mt-2" />
          </div>
          <div className="h-10 w-32 bg-gray-200 rounded-full" />
        </header>
        <div className="h-6 w-48 bg-gray-200 rounded-lg mt-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-64 bg-gray-100 rounded-[24px]" />
          <div className="h-64 bg-gray-100 rounded-[24px]" />
          <div className="h-64 bg-gray-100 rounded-[24px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-12">
      {/* Page Header */}
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-[#111111] tracking-tight">Partner & Payout Center</h2>
          <p className="text-xs text-[#64646A] mt-1 font-medium">Verify driver documents, clear payout requests, and monitor partner accounts.</p>
        </div>
        <button
          onClick={() => loadData(true)}
          className="flex items-center gap-2 bg-[#111111] hover:bg-black text-white px-5 py-2.5 rounded-full text-xs font-semibold active:scale-95 transition-all cursor-pointer shadow-xs"
          style={{ paddingLeft: "20px", paddingRight: "20px", paddingTop: "10px", paddingBottom: "10px" }}
        >
          <RefreshCw size={12} />
          <span>Refresh All</span>
        </button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center max-w-md mx-auto my-2 text-red-700 font-semibold">
          {error}
        </div>
      )}

      {/* 1. Pending Payout Requests Section */}
      <section className="flex flex-col gap-4">
        <h3 className="text-xl font-extrabold text-[#111111]">Pending Payouts</h3>
        {payoutRequests.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center bg-white rounded-[24px] border border-[#EBEBEF]"
            style={{ padding: "48px" }}
          >
            <CheckCircle2 className="text-[#10B981] h-12 w-12" />
            <h4 className="text-base font-bold text-[#111111] mt-3">All caught up!</h4>
            <p className="text-xs text-[#66666A] mt-1">No delivery partners have requested payouts.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {payoutRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-[24px] bg-white border border-[#EBEBEF] shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200"
                style={{ padding: "24px" }}
              >
                <div>
                  <div className="flex justify-between items-start border-b border-[#F4F4F5] pb-4">
                    <div>
                      <h4 className="text-base font-bold text-[#111111]">{req.name}</h4>
                      <p className="text-xs text-[#66666A] mt-0.5">{req.phone}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-[#66666A] block">Unpaid Balance</span>
                      <span className="text-lg font-extrabold text-[#ED7D4B] block mt-0.5">INR {req.unpaidAmount}</span>
                    </div>
                  </div>

                  <div className="mt-4 mb-4">
                    <span className="text-[10px] font-bold text-[#66666A] uppercase tracking-wider block">Linked UPI ID</span>
                    <div
                      className="mt-2 flex items-center justify-between rounded-xl bg-[#F4F4F5] border border-gray-100"
                      style={{ padding: "12px" }}
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        <Wallet size={16} className="text-[#111111] shrink-0" />
                        <span className="ml-3 text-xs font-semibold text-[#111111] truncate">{req.upiId || "No UPI ID linked"}</span>
                      </div>
                      {req.upiId && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(req.upiId!);
                            alert("UPI ID copied to clipboard!");
                          }}
                          className="text-[10px] font-bold bg-white border border-[#E9E9EC] hover:bg-gray-50 text-[#111111] rounded px-2 py-1 shrink-0 cursor-pointer active:scale-95 transition-all"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                    {req.upiId ? (
                      <p className="text-[10px] text-[#66666A] mt-2 font-medium leading-relaxed">
                        Copy this UPI ID, transfer <strong>INR {req.unpaidAmount}</strong> to the partner via your payment app (GPay, PhonePe, Paytm, etc.), then click "Mark as Paid" and enter the UTR code to record this payout.
                      </p>
                    ) : (
                      <div className="mt-2 bg-[#FFF5F5] border border-[#FECACA] rounded-xl flex flex-col gap-1 text-[11px] text-[#DC2626]" style={{ padding: "12px" }}>
                        <span className="font-bold">No UPI ID is linked to this driver account.</span>
                        <span className="text-gray-500">Contact the driver to request them to link a UPI ID inside their driver app profile:</span>
                        <div className="flex gap-2.5 mt-1">
                          <a href={`tel:${req.phone}`} className="text-[#111111] underline hover:text-black font-bold flex items-center gap-1">
                            <Phone size={10} /> Call Driver
                          </a>
                          <span>•</span>
                          <a href={`https://wa.me/${req.phone.replace(/[^0-9]/g, "")}`} target="_blank" className="text-emerald-600 underline hover:text-emerald-700 font-bold flex items-center gap-1">
                            <MessageSquare size={10} /> WhatsApp
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  disabled={!req.upiId || clearingId === req.id}
                  onClick={() => {
                    setSelectedPayout(req);
                    setUtrInput("");
                  }}
                  className={`w-full flex items-center justify-center gap-2 rounded-full font-semibold active:scale-95 transition-all text-sm cursor-pointer ${
                    req.upiId
                      ? "bg-[#111111] hover:bg-black text-white"
                      : "bg-[#E5E5EA] text-[#8E8E93] cursor-not-allowed"
                  }`}
                  style={{ paddingTop: "12px", paddingBottom: "12px" }}
                >
                  <CheckCircle2 size={16} />
                  <span>{clearingId === req.id ? "Syncing..." : "Mark as Paid"}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. Driver License Verification Reviews Section */}
      <section className="flex flex-col gap-4">
        <h3 className="text-xl font-extrabold text-[#111111]">Partner Verification</h3>
        {pendingPartners.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center bg-white rounded-[24px] border border-[#EBEBEF]"
            style={{ padding: "48px" }}
          >
            <CheckCircle2 className="text-[#10B981] h-12 w-12" />
            <h4 className="text-base font-bold text-[#111111] mt-3">No pending reviews</h4>
            <p className="text-xs text-[#66666A] mt-1">All driver accounts are up to date and verified.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingPartners.map((partner) => (
              <div
                key={partner.id}
                className="rounded-[24px] bg-white border border-[#EBEBEF] shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200"
                style={{ padding: "24px" }}
              >
                <div>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-[#111111] truncate">{partner.name}</h4>
                      <div className="mt-1 flex flex-col gap-1">
                        <p className="text-xs text-[#66666A] font-medium">{partner.phone}</p>
                        <p className="text-xs text-[#66666A] font-semibold">{partner.vehicleType.toLowerCase().replace(/_/g, " ")}</p>
                      </div>
                      <div className="mt-2.5">
                        <span
                          className="rounded-full bg-[#FFF4D8] text-[#9A6200] border border-[#E5B800] text-[10px] font-bold tracking-wide uppercase px-2.5 py-1"
                        >
                          ⏳ PENDING REVIEW
                        </span>
                      </div>
                    </div>
                    {partner.profilePhotoUrl ? (
                      <img
                        src={partner.profilePhotoUrl}
                        className="h-14 w-14 rounded-full object-cover shrink-0 ml-3 border border-[#EBEBEF]"
                        alt=""
                        onError={(e) => { (e.target as any).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-[#F4F4F5] border border-[#EBEBEF] flex items-center justify-center shrink-0 ml-3">
                        <span className="text-[#66666A] font-bold text-[10px]">Driver</span>
                      </div>
                    )}
                  </div>

                  {/* Verification Documents Section */}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {/* 1. Profile Photo */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-[#66666A] uppercase tracking-wide">Profile Photo</span>
                      {partner.profilePhotoUrl ? (
                        <div className="relative overflow-hidden rounded-xl border border-[#EBEBEF] bg-[#F4F4F5]">
                          <img
                            src={partner.profilePhotoUrl}
                            className="w-full h-28 object-cover cursor-zoom-in hover:scale-105 transition-all duration-300 rounded-xl"
                            alt="Profile Preview"
                            onClick={() => window.open(partner.profilePhotoUrl!, "_blank")}
                            onError={(e) => {
                              (e.target as any).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-28 rounded-xl bg-[#F4F4F5] border border-[#EBEBEF] flex items-center justify-center text-center p-2">
                          <span className="text-[10px] text-[#9A9AA0] font-medium leading-tight">No profile photo</span>
                        </div>
                      )}
                    </div>

                    {/* 2. Driver's License */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-[#66666A] uppercase tracking-wide">Driver License</span>
                      {partner.dlUrl ? (
                        <div className="relative overflow-hidden rounded-xl border border-[#EBEBEF] bg-[#F4F4F5]">
                          <img
                            src={partner.dlUrl}
                            className="w-full h-28 object-cover cursor-zoom-in hover:scale-105 transition-all duration-300 rounded-xl"
                            alt="Driver License Preview"
                            onClick={() => window.open(partner.dlUrl!, "_blank")}
                            onError={(e) => {
                              (e.target as any).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-28 rounded-xl bg-[#FFF5F5] border border-[#FECACA] flex items-center justify-center text-center p-2">
                          <span className="text-[10px] text-[#DC2626] font-medium leading-tight">No DL document</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Buttons to open in new tab */}
                  <div className="mt-3 flex gap-2">
                    {partner.profilePhotoUrl && (
                      <button
                        onClick={() => window.open(partner.profilePhotoUrl!, "_blank")}
                        className="flex-1 flex items-center justify-center gap-1 bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#111111] rounded-full text-[10px] font-semibold active:scale-95 transition-all cursor-pointer border border-[#E9E9EC] py-2"
                      >
                        <ExternalLink size={10} />
                        <span>View Photo</span>
                      </button>
                    )}
                    {partner.dlUrl && (
                      <button
                        onClick={() => window.open(partner.dlUrl!, "_blank")}
                        className="flex-1 flex items-center justify-center gap-1 bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#111111] rounded-full text-[10px] font-semibold active:scale-95 transition-all cursor-pointer border border-[#E9E9EC] py-2"
                      >
                        <ExternalLink size={10} />
                        <span>View DL</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    disabled={verifyingId === partner.id}
                    onClick={() => openDecisionModal(partner.id, partner.name, "APPROVED")}
                    className="flex-1 bg-[#10B981] hover:bg-[#0E9F6E] text-white rounded-full text-xs font-bold active:scale-95 transition-all cursor-pointer"
                    style={{ paddingTop: "12px", paddingBottom: "12px" }}
                  >
                    Approve
                  </button>
                  <button
                    disabled={verifyingId === partner.id}
                    onClick={() => openDecisionModal(partner.id, partner.name, "REJECTED")}
                    className="flex-1 bg-white hover:bg-[#FFF5F5] border border-[#FECACA] text-[#DC2626] rounded-full text-xs font-bold active:scale-95 transition-all cursor-pointer"
                    style={{ paddingTop: "12px", paddingBottom: "12px" }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Registered Drivers Directory Section */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <h3 className="text-xl font-extrabold text-[#111111]">All Partners</h3>
          <div className="flex flex-wrap gap-1 bg-white p-1 rounded-full border border-[#EBEBEF] shadow-sm">
            {(["ALL", "APPROVED", "INCOMPLETE", "REJECTED"] as const).map((filter) => (
              <button
                key={filter}
                className={`rounded-full px-4 py-2 text-xs font-semibold cursor-pointer active:scale-95 transition-all ${
                  partnerFilter === filter
                    ? "bg-[#111111] text-white"
                    : "text-[#66666A] hover:bg-gray-50 hover:text-[#111111]"
                }`}
                onClick={() => setPartnerFilter(filter)}
              >
                {filter === "ALL" ? "All" : filter.charAt(0) + filter.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {filteredPartners.length === 0 ? (
          <div
            className="rounded-[24px] bg-white p-10 border border-[#EBEBEF] flex flex-col items-center justify-center text-center"
            style={{ padding: "48px" }}
          >
            <CheckCircle2 className="text-[#9A9AA0] h-12 w-12" />
            <h4 className="text-base font-bold text-[#646468] mt-3">No partners match filter</h4>
            <p className="text-sm text-[#9A9AA0] mt-1">There are no drivers matching the selected profile status.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPartners.map((partner) => {
              const isApproved = partner.profileStatus === "APPROVED";
              const isPending = partner.profileStatus === "PENDING";
              const isIncomplete = !partner.profileStatus || partner.profileStatus === "INCOMPLETE" || partner.profileStatus === "NOT_SUBMITTED";
              return (
                <div
                  key={partner.id}
                  className="rounded-[24px] bg-white border border-[#EBEBEF] shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-200"
                  style={{ padding: "24px" }}
                >
                  <div>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-bold text-[#111111] truncate">{partner.name}</h4>
                        <p className="text-xs text-[#66666A] mt-1 font-medium">{partner.phone} • {partner.vehicleType.toLowerCase().replace(/_/g, " ")}</p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full text-[10px] font-bold tracking-wide uppercase shrink-0`}
                        style={{
                          paddingLeft: "10px",
                          paddingRight: "10px",
                          paddingTop: "4px",
                          paddingBottom: "4px",
                          backgroundColor: isApproved
                            ? "#E5F4E3"
                            : isPending
                            ? "#FFF3E0"
                            : isIncomplete
                            ? "#FFF4D8"
                            : "#FDECEA",
                          color: isApproved
                            ? "#1F7A1F"
                            : isPending
                            ? "#E65100"
                            : isIncomplete
                            ? "#9A6200"
                            : "#B71C1C"
                        }}
                      >
                        {isApproved ? (
                          <BadgeCheck size={12} />
                        ) : isPending ? (
                          <ShieldAlert size={12} />
                        ) : isIncomplete ? (
                          <ShieldAlert size={12} />
                        ) : (
                          <BadgeAlert size={12} />
                        )}
                        {partner.profileStatus || "INCOMPLETE"}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#66666A]">Linked UPI ID:</span>
                        <span className="font-semibold text-[#111111] font-mono truncate max-w-[65%]">{partner.upiId || "None"}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#66666A]">Unpaid Balance:</span>
                        <span className="font-bold text-[#ED7D4B]">INR {partner.unpaidAmount || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs text-[#66666A]">Availability Status</span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${partner.isAvailable ? "text-[#10B981]" : "text-[#9A9AA0]"}`}>
                      <span className={`h-2 w-2 rounded-full ${partner.isAvailable ? "bg-[#10B981] animate-pulse" : "bg-[#9A9AA0]"}`} />
                      {partner.isAvailable ? "On Duty" : "Offline"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {selectedPayout && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-fade-in shadow-xl flex flex-col gap-4">
            <div className="flex justify-between items-start border-b border-[#F4F4F5] pb-4">
              <div>
                <h3 className="text-xl font-bold text-[#111111]">Process Payout</h3>
                <p className="text-sm text-[#66666A] mt-1">For {selectedPayout.name}</p>
              </div>
              <button 
                onClick={() => setSelectedPayout(null)}
                className="text-[#9A9AA0] hover:text-[#111111] p-1 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="bg-[#F4F4F5] rounded-xl p-4 flex flex-col items-center gap-3">
              <span className="text-xs font-bold text-[#66666A] uppercase tracking-wide">Amount to Pay</span>
              <span className="text-3xl font-extrabold text-[#ED7D4B]">INR {selectedPayout.unpaidAmount}</span>
            </div>

            <div className="flex flex-col items-center gap-2 mt-2">
              <p className="text-sm text-center font-medium text-[#111111]">
                Scan with any UPI App to Pay
              </p>
              <div className="p-3 bg-white border border-[#EBEBEF] rounded-xl shadow-sm">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${selectedPayout.upiId}&pn=${selectedPayout.name}&am=${selectedPayout.unpaidAmount}&cu=INR`)}`} 
                  alt="UPI QR Code" 
                  className="w-40 h-40"
                />
              </div>
              <div className="flex items-center gap-2 mt-2 bg-[#F9F9FB] border border-[#EBEBEF] px-4 py-2 rounded-full w-full justify-between">
                <span className="text-xs font-mono text-[#33343A] truncate">{selectedPayout.upiId}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedPayout.upiId!);
                    alert("UPI ID copied!");
                  }}
                  className="text-[10px] font-bold text-[#ED7D4B] hover:underline shrink-0 cursor-pointer"
                >
                  COPY
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <label className="text-xs font-bold text-[#111111] pl-1">UTR Reference Number</label>
              <input 
                type="text"
                placeholder="Enter transaction ID (UTR)"
                className="w-full bg-[#F4F4F5] border border-[#EBEBEF] rounded-xl text-sm text-[#111111] px-4 py-3 focus:outline-none focus:border-[#ED7D4B] focus:bg-white transition-colors"
                value={utrInput}
                onChange={(e) => setUtrInput(e.target.value)}
              />
            </div>

            <button
              disabled={clearingId === selectedPayout.id}
              onClick={submitPayout}
              className="w-full bg-[#111111] hover:bg-black text-white font-bold py-3.5 rounded-full mt-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              {clearingId === selectedPayout.id ? "Processing..." : "Confirm & Mark as Paid"}
            </button>
          </div>
        </div>
      )}

      {decisionModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-fade-in shadow-xl flex flex-col gap-5 text-center">
            {decisionModal.status === "idle" && (
              <>
                <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#111111]">
                    {decisionModal.action === "APPROVED" ? "Approve" : "Reject"} License?
                  </h3>
                  <p className="text-xs text-[#66666A] mt-2 leading-relaxed">
                    Are you sure you want to {decisionModal.action === "APPROVED" ? "approve" : "reject"} the driver's license for <strong>{decisionModal.partnerName}</strong>? This action will update their account status immediately.
                  </p>
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setDecisionModal((prev) => ({ ...prev, isOpen: false }))}
                    className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-[#66666A] font-semibold py-3 rounded-full text-xs active:scale-95 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeVerifyPartner}
                    className={`flex-1 text-white font-bold py-3 rounded-full text-xs active:scale-95 transition-all cursor-pointer ${
                      decisionModal.action === "APPROVED" ? "bg-[#10B981] hover:bg-[#0E9F6E]" : "bg-[#DC2626] hover:bg-[#B71C1C]"
                    }`}
                  >
                    Confirm
                  </button>
                </div>
              </>
            )}

            {decisionModal.status === "loading" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <svg className="animate-spin h-8 w-8 text-[#ED7D4B]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-[#6C6C70] text-sm font-semibold tracking-wide">Processing request...</span>
              </div>
            )}

            {decisionModal.status === "success" && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-[#111111]">Action Complete</h4>
                  <p className="text-xs text-[#66666A] mt-2 px-2">
                    {decisionModal.message}
                  </p>
                </div>
              </div>
            )}

            {decisionModal.status === "error" && (
              <>
                <div className="mx-auto h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                  <BadgeAlert size={28} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-[#111111]">Verification Failed</h4>
                  <p className="text-xs text-[#DC2626] mt-2 bg-red-50 border border-red-100 p-2.5 rounded-xl font-medium leading-relaxed">
                    {decisionModal.message}
                  </p>
                </div>
                <button
                  onClick={() => setDecisionModal((prev) => ({ ...prev, isOpen: false }))}
                  className="w-full bg-[#111111] hover:bg-black text-white font-semibold py-3 rounded-full text-xs active:scale-95 transition-all cursor-pointer"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
