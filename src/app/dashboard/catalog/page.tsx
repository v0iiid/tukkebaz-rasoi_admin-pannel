"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, Room, Service, DeliveryItem, DeliveryOrder, ServiceType } from "@/lib/api";
import { GlobalCache } from "@/lib/cache";
import {  X } from "lucide-react";

const formatDateTime = (value?: string | null): string => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type CatalogCategory = "rooms" | "services" | "food" | "grocery";

type RoomFormState = {
  id: string | null;
  title: string;
  description: string;
  price: string;
  imageUrl: string;
  roomPhotos: Array<{ urls: string[]; type: string }>;
  roomPhotoTypes: string;
  address: string;
  ownerPhone: string;
  tags: string;
  latitude: string;
  longitude: string;
  capacity: string;
};

type ServiceFormState = {
  id: string | null;
  title: string;
  description: string;
  price: string;
  imageUrl: string;
  imageUrls: string;
  detailSections: Array<{ title: string; body: string; items: string }>;
  activityOptions: Array<{ id: string; title: string; description: string; pricePerGuest: string }>;
  requiredDocuments: string;
  pickupAddress: string;
  contactPhone: string;
  latitude: string;
  longitude: string;
  ctaLabel: string;
  type: ServiceType;
};

type DeliveryItemFormState = {
  id: string | null;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  category: "FOOD" | "GROCERY";
  grocerySection: string;
  servingInfo: string;
  pieces: string;
  availableQuantity: string;
  isAvailable: boolean;
};

export default function CatalogPage() {
  const [catalogCategory, setCatalogCategory] = useState<CatalogCategory>("rooms");
  const [loading, setLoading] = useState(!GlobalCache.catalogRooms);
  const [error, setError] = useState<string | null>(null);
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [adminDeliveryOrders, setAdminDeliveryOrders] = useState<DeliveryOrder[]>([]);

  // Catalog Lists
  const [rooms, setRooms] = useState<Room[]>(GlobalCache.catalogRooms || []);
  const [services, setServices] = useState<Service[]>(GlobalCache.catalogServices || []);

  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>(GlobalCache.catalogDeliveryItems || []);

  // Pending counts for badges
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>(GlobalCache.catalogPendingCounts || { rooms: 0, services: 0, food: 0, grocery: 0 });

  // Home Page Icons
  const [homeIcons, setHomeIcons] = useState<string[]>(GlobalCache.catalogHomeIcons || [
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300",
  ]);

  // Leaflet Map instance ref
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Scroll Ref
  const formRef = useRef<HTMLDivElement>(null);

  // Forms states
  const initialRoomForm = (): RoomFormState => ({
    id: null,
    title: "",
    description: "",
    price: "",
    imageUrl: "",
    roomPhotos: [
      { type: "Bedroom", urls: [] },
      { type: "Bedroom area", urls: [] },
      { type: "Bathroom", urls: [] },
      { type: "Exterior", urls: [] },
    ],
    roomPhotoTypes: "Bedroom, Bedroom area, Bathroom, Exterior",
    address: "",
    ownerPhone: "",
    tags: "",
    latitude: "29.472403",
    longitude: "79.646942",
    capacity: "2",
  });

  const initialServiceForm = (): ServiceFormState => ({
    id: null,
    title: "",
    description: "",
    price: "",
    imageUrl: "",
    imageUrls: "",
    detailSections: [],
    activityOptions: [],
    requiredDocuments: "",
    pickupAddress: "",
    contactPhone: "",
    latitude: "29.472403",
    longitude: "79.646942",
    ctaLabel: "",
    type: "RENT_SCOOTY",
  });

  const initialDeliveryForm = (): DeliveryItemFormState => ({
    id: null,
    name: "",
    description: "",
    price: "",
    imageUrl: "",
    category: "FOOD",
    grocerySection: "",
    servingInfo: "",
    pieces: "",
    availableQuantity: "100",
    isAvailable: true,
  });

  const [roomForm, setRoomForm] = useState<RoomFormState>(initialRoomForm());
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(initialServiceForm());
  const [deliveryForm, setDeliveryForm] = useState<DeliveryItemFormState>(initialDeliveryForm());

  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const handleUpdateHomeIcons = async (newIcons: string[]) => {
    setHomeIcons(newIcons);
    GlobalCache.catalogHomeIcons = newIcons;
    try {
      await api.updateHomeIcons(newIcons);
    } catch (err: any) {
      console.error("Failed to update home icons", err);
    }
  };

  const fetchCatalog = useCallback(async (showPulse = !GlobalCache.catalogRooms) => {
    try {
      if (showPulse) setLoading(true);
      setError(null);

      const [analytics, orders, roomsData, servicesData, dItemsData, iconsData] = await Promise.all([
        api.getAnalytics().catch(() => ({ recentBookings: [] })),
        api.getKitchenOrders().catch(() => []),
        api.getRooms().catch(() => []),
        api.getServices().catch(() => []),
        api.getKitchenItems().catch(() => []),
        api.getHomeIcons().catch(() => [])
      ]);

      const bookings = analytics.recentBookings || [];
      const newCounts = {
        rooms: bookings.filter((b: any) => b.paymentStatus === "PENDING" && b.kind === "ROOM").length,
        services: bookings.filter((b: any) => b.paymentStatus === "PENDING" && b.kind === "SERVICE").length,
        food: orders.filter((o: any) => o.status === "PENDING").length,
        grocery: 0
      };

      GlobalCache.catalogRooms = roomsData;
      GlobalCache.catalogServices = servicesData;
      GlobalCache.catalogDeliveryItems = dItemsData;
      GlobalCache.catalogPendingCounts = newCounts;
      if (iconsData && iconsData.length > 0) {
        GlobalCache.catalogHomeIcons = iconsData;
        setHomeIcons(iconsData);
      }

      setRooms(roomsData);
      setServices(servicesData);
      setDeliveryItems(dItemsData);
      setAdminDeliveryOrders(orders);
      setPendingCounts(newCounts);
    } catch (err: any) {
      setError(err.message || "Failed to load catalog data.");
    } finally {
      if (showPulse) setLoading(false);
    }
  }, [catalogCategory]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Dynamically load Leaflet for Location Selection Preview
  useEffect(() => {
    if (typeof window !== "undefined") {
      const linkId = "leaflet-css";
      const scriptId = "leaflet-js";

      if (!document.getElementById(linkId)) {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => {
          initializeLeafletMap();
        };
        document.head.appendChild(script);
      } else {
        initializeLeafletMap();
      }
    }
  }, [catalogCategory, roomForm.id, serviceForm.id]);

  const initializeLeafletMap = () => {
    const L = (window as any).L;
    if (!L) return;

    const mapContainer = document.getElementById("leaflet-map-container");
    if (!mapContainer) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const lat = parseFloat(catalogCategory === "rooms" ? roomForm.latitude : serviceForm.latitude) || 29.472403;
    const lng = parseFloat(catalogCategory === "rooms" ? roomForm.longitude : serviceForm.longitude) || 79.646942;

    const map = L.map("leaflet-map-container").setView([lat, lng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      if (catalogCategory === "rooms") {
        setRoomForm((prev) => ({ ...prev, latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6) }));
      } else {
        setServiceForm((prev) => ({ ...prev, latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6) }));
      }
    });

    mapRef.current = map;
    markerRef.current = marker;
  };

  const syncMapMarker = (latVal: string, lngVal: string) => {
    const lat = parseFloat(latVal);
    const lng = parseFloat(lngVal);
    if (!isNaN(lat) && !isNaN(lng) && markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng]);
    }
  };

  const handleEditRoom = (room: Room) => {
    const formattedPhotos = room.roomPhotos?.map((p) => ({
      type: p.type || "",
      urls: p.urls || (p.url ? [p.url] : []),
    })) || [];

    setRoomForm({
      id: room.id,
      title: room.title || "",
      description: room.description || "",
      price: room.price?.toString() || "",
      imageUrl: room.imageUrl || "",
      roomPhotos: formattedPhotos.length > 0 ? formattedPhotos : initialRoomForm().roomPhotos,
      roomPhotoTypes: room.roomPhotoTypes?.join(", ") || "Bedroom, Bedroom area, Bathroom, Exterior",
      address: room.address || "",
      ownerPhone: room.ownerPhone || "",
      tags: room.tags?.join(", ") || "",
      latitude: room.latitude?.toString() || "29.472403",
      longitude: room.longitude?.toString() || "79.646942",
      capacity: room.capacity?.toString() || "2",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleEditService = (service: Service) => {
    setServiceForm({
      id: service.id,
      title: service.title || "",
      description: service.description || "",
      price: service.price?.toString() || "",
      imageUrl: service.imageUrl || "",
      imageUrls: service.imageUrls?.join(", ") || "",
      detailSections: service.detailSections?.map((ds) => ({
        title: ds.title || "",
        body: ds.body || "",
        items: ds.items?.join(", ") || "",
      })) || [],
      activityOptions: service.activityOptions?.map((opt) => ({
        id: opt.id || "",
        title: opt.title || "",
        description: opt.description || "",
        pricePerGuest: opt.pricePerGuest?.toString() || "",
      })) || [],
      requiredDocuments: service.requiredDocuments?.join(", ") || "",
      pickupAddress: service.pickupAddress || "",
      contactPhone: service.contactPhone || "",
      latitude: service.latitude?.toString() || "29.472403",
      longitude: service.longitude?.toString() || "79.646942",
      ctaLabel: service.ctaLabel || "",
      type: service.type || "RENT_SCOOTY",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleEditDelivery = (item: DeliveryItem) => {
    setDeliveryForm({
      id: item.id,
      name: item.name || "",
      description: item.description || "",
      price: item.price?.toString() || "",
      imageUrl: item.imageUrl || "",
      category: item.category || "FOOD",
      grocerySection: item.grocerySection || "",
      servingInfo: item.servingInfo || "",
      pieces: item.grocerySection || "",
      availableQuantity: item.availableQuantity?.toString() || "100",
      isAvailable: item.isAvailable,
    });
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDeleteRoom = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete room "${title}"?`)) {
      try {
        await api.deleteRoom(id);
        fetchCatalog();
      } catch (err: any) {
        alert(err.message || "Failed to delete room.");
      }
    }
  };

  const handleDeleteService = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete service "${title}"?`)) {
      try {
        await api.deleteService(id);
        fetchCatalog();
      } catch (err: any) {
        alert(err.message || "Failed to delete service.");
      }
    }
  };

  const uploadFile = async (file: File, onDone: (url: string) => void, fieldId: string) => {
    setUploadingField(fieldId);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Str = (reader.result as string).split(",")[1];
          const res = await api.uploadImage(base64Str, file.name);
          onDone(res.url);
        } catch (err: any) {
          alert(err.message || "Image upload failed.");
        } finally {
          setUploadingField(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingField(null);
    }
  };

  const saveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const payload: Partial<Room> = {
        title: roomForm.title,
        description: roomForm.description,
        price: parseFloat(roomForm.price) || 0,
        imageUrl: roomForm.imageUrl || null,
        imageUrls: roomForm.imageUrl ? [roomForm.imageUrl] : [],
        roomPhotos: roomForm.roomPhotos.map((p) => ({
          type: p.type,
          urls: p.urls.filter(Boolean),
        })),
        roomPhotoTypes: roomForm.roomPhotoTypes.split(",").map((s) => s.trim()).filter(Boolean),
        address: roomForm.address || null,
        ownerPhone: roomForm.ownerPhone || null,
        tags: roomForm.tags.split(",").map((s) => s.trim()).filter(Boolean),
        latitude: parseFloat(roomForm.latitude) || null,
        longitude: parseFloat(roomForm.longitude) || null,
        capacity: parseInt(roomForm.capacity) || 2,
      };

      if (roomForm.id) {
        await api.updateRoom(roomForm.id, payload);
      } else {
        await api.createRoom(payload);
      }
      setRoomForm(initialRoomForm());
      fetchCatalog();
    } catch (err: any) {
      alert(err.message || "Failed to save room.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const saveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const payload: Partial<Service> = {
        title: serviceForm.title,
        description: serviceForm.description,
        price: parseFloat(serviceForm.price) || 0,
        imageUrl: serviceForm.imageUrl || null,
        imageUrls: serviceForm.imageUrls.split(",").map((s) => s.trim()).filter(Boolean),
        detailSections: serviceForm.detailSections.map((ds) => ({
          title: ds.title,
          body: ds.body,
          items: ds.items.split(",").map((s) => s.trim()).filter(Boolean),
        })),
        activityOptions: serviceForm.activityOptions.map((opt) => ({
          id: opt.id || undefined,
          title: opt.title,
          description: opt.description,
          pricePerGuest: parseFloat(opt.pricePerGuest) || 0,
        })),
        requiredDocuments: serviceForm.requiredDocuments.split(",").map((s) => s.trim()).filter(Boolean),
        pickupAddress: serviceForm.pickupAddress || null,
        contactPhone: serviceForm.contactPhone || null,
        latitude: parseFloat(serviceForm.latitude) || null,
        longitude: parseFloat(serviceForm.longitude) || null,
        ctaLabel: serviceForm.ctaLabel || null,
        type: serviceForm.type,
      };

      if (serviceForm.id) {
        await api.updateService(serviceForm.id, payload);
      } else {
        await api.createService(payload);
      }
      setServiceForm(initialServiceForm());
      fetchCatalog();
    } catch (err: any) {
      alert(err.message || "Failed to save service.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const saveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const category: "FOOD" | "GROCERY" = catalogCategory === "food" ? "FOOD" : "GROCERY";
      const payload: Partial<DeliveryItem> = {
        name: deliveryForm.name,
        description: deliveryForm.description || "",
        price: parseFloat(deliveryForm.price) || 0,
        imageUrl: deliveryForm.imageUrl || null,
        category,
        grocerySection: category === "GROCERY" ? deliveryForm.grocerySection : deliveryForm.pieces,
        servingInfo: deliveryForm.servingInfo || null,
        availableQuantity: parseInt(deliveryForm.availableQuantity) || 0,
        isAvailable: deliveryForm.isAvailable,
      };

      if (deliveryForm.id) {
        await api.updateKitchenItem(deliveryForm.id, payload);
      } else {
        await api.createKitchenItem(payload);
      }
      setDeliveryForm(initialDeliveryForm());
      fetchCatalog();
    } catch (err: any) {
      alert(err.message || "Failed to save item.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const filteredDeliveryItems = useMemo(() => {
    const filterCat = catalogCategory === "food" ? "FOOD" : "GROCERY";
    const base = deliveryItems.filter((item) => item.category === filterCat);
    if (!foodSearchQuery.trim()) return base;
    const query = foodSearchQuery.toLowerCase();
    return base.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        (item.grocerySection && item.grocerySection.toLowerCase().includes(query))
    );
  }, [deliveryItems, catalogCategory, foodSearchQuery]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">

      {/* Home Page Icons Manager */}
      <div
        className="rounded-[28px] bg-white border border-[#EBEBEF] shadow-xs"
        style={{ padding: "24px", marginBottom: "24px" }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-[#111111]">Home Page Icons</h3>
          <label
            className="rounded-full border border-gray-200 hover:bg-gray-50 text-[#111111] text-xs font-semibold cursor-pointer active:scale-95 transition-all"
            style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px" }}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  uploadFile(
                    file,
                    (url) => {
                      const newIcons = [...homeIcons, url].slice(0, 5);
                      handleUpdateHomeIcons(newIcons);
                    },
                    "homeIconUpload"
                  );
                }
              }}
            />
            {uploadingField === "homeIconUpload" ? "..." : "Add Image"}
          </label>
        </div>

        <div className="flex gap-3 overflow-x-auto py-1.5 scrollbar-none">
          {homeIcons.map((url, idx) => (
            <div key={idx} className="relative h-20 w-20 rounded-2xl overflow-hidden border border-[#EBEBEF] shrink-0 group">
              <img src={url} alt={`icon-${idx}`} className="h-full w-full object-cover" />
              <button
                onClick={() => {
                  const newIcons = homeIcons.filter((_, i) => i !== idx);
                  handleUpdateHomeIcons(newIcons);
                }}
                className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black text-white p-1 rounded-full active:scale-90 transition-all cursor-pointer"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[#9A9AA0] font-bold mt-2">{homeIcons.length}/5</p>
      </div>

      {/* Category Switcher Pills */}
      <div
        className="flex flex-wrap gap-1 rounded-full bg-white border border-[#EBEBEF] shadow-sm p-1 self-start"
        style={{ marginBottom: "24px" }}
      >
        {([
          { key: "rooms", label: "Room" },
          { key: "services", label: "Services" },
          { key: "food", label: "Food" },
          { key: "grocery", label: "Grocery" },
        ] as { key: CatalogCategory; label: string }[]).map((cat) => {
          const active = catalogCategory === cat.key;
          const count = pendingCounts[cat.key] || 0;
          return (
            <button
              key={cat.key}
              onClick={() => {
                setCatalogCategory(cat.key);
                setFoodSearchQuery("");
              }}
              className={`relative rounded-full text-sm font-semibold transition-all cursor-pointer ${
                active ? "bg-[#111111] text-white" : "text-[#66666A] hover:bg-gray-50 hover:text-[#111111]"
              }`}
              style={{
                paddingLeft: "20px",
                paddingRight: "20px",
                paddingTop: "10px",
                paddingBottom: "10px",
              }}
            >
              {cat.label}
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#F04646] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-sm">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* Left Column: Form Section */}
        <div
          ref={formRef}
          className="rounded-[28px] bg-white border border-[#EBEBEF] shadow-sm"
          style={{ padding: "28px" }}
        >
          {catalogCategory === "rooms" && (
            <form onSubmit={saveRoom} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-[#171717]">
                {roomForm.id ? "Edit Room" : "Add Room"}
              </h2>
              <input
                type="text"
                required
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                placeholder="Room title"
                value={roomForm.title}
                onChange={(e) => setRoomForm((prev) => ({ ...prev, title: e.target.value }))}
              />
              <textarea
                required
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow min-h-[92px] placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                placeholder="Room description"
                value={roomForm.description}
                onChange={(e) => setRoomForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  required
                  className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Price"
                  value={roomForm.price}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, price: e.target.value }))}
                />
                <input
                  type="number"
                  required
                  className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Capacity"
                  value={roomForm.capacity}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, capacity: e.target.value }))}
                />
              </div>

              {/* Cover image upload */}
              <div>
                <span className="text-[11px] font-bold text-[#64646A] uppercase block mb-1.5 ml-1">Main room image</span>
                <label
                  className="w-full bg-[#111111] hover:bg-black text-white rounded-[24px] text-sm font-semibold flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs"
                  style={{ paddingTop: "12px", paddingBottom: "12px" }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        uploadFile(file, (url) => setRoomForm((prev) => ({ ...prev, imageUrl: url })), "roomCover");
                      }
                    }}
                  />
                  {uploadingField === "roomCover" ? "..." : "Upload Image"}
                </label>
                {roomForm.imageUrl && (
                  <div className="mt-2 relative h-24 rounded-[24px] overflow-hidden border border-gray-200">
                    <img src={roomForm.imageUrl} alt="Room cover" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>

              {/* Photos dynamic container */}
              <div className="mt-2 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-bold text-[#111111]">Room photos</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newType = window.prompt("Enter new photo area type:");
                      if (newType) {
                        setRoomForm((prev) => ({
                          ...prev,
                          roomPhotos: [...prev.roomPhotos, { type: newType, urls: [] }],
                        }));
                      }
                    }}
                    className="bg-[#111111] hover:bg-black text-white text-[11px] font-bold rounded-full active:scale-90 transition-all cursor-pointer"
                    style={{ paddingLeft: "12px", paddingRight: "12px", paddingTop: "6px", paddingBottom: "6px" }}
                  >
                    Add type
                  </button>
                </div>

                {roomForm.roomPhotos.map((photoGroup, idx) => (
                  <div
                    key={idx}
                    className="bg-[#F7F7F8] border border-[#EBEBEF] rounded-2xl flex flex-col gap-3 shadow-xs"
                    style={{ padding: "16px" }}
                  >
                    <div className="flex items-end gap-3 w-full">
                      <div className="flex-1">
                        <span className="text-[10px] font-bold text-[#9A9AA0] uppercase block mb-1">Photo type</span>
                        <input
                          type="text"
                          className="w-full bg-white border border-[#DEDEE2] rounded-lg text-xs text-[#111111]"
                          style={{ paddingLeft: "12px", paddingRight: "12px", paddingTop: "8px", paddingBottom: "8px" }}
                          value={photoGroup.type}
                          onChange={(e) => {
                            const nextVal = e.target.value;
                            setRoomForm((prev) => {
                              const list = [...prev.roomPhotos];
                              list[idx].type = nextVal;
                              return { ...prev, roomPhotos: list };
                            });
                          }}
                        />
                      </div>
                      <label
                        className="bg-[#111111] hover:bg-black text-white text-xs font-bold rounded-lg cursor-pointer active:scale-95 transition-all flex items-center justify-center shrink-0"
                        style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px", height: "34px" }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              uploadFile(
                                file,
                                (url) => {
                                  setRoomForm((prev) => {
                                    const list = [...prev.roomPhotos];
                                    list[idx].urls = [...list[idx].urls, url];
                                    return { ...prev, roomPhotos: list };
                                  });
                                },
                                `roomPhoto-${idx}`
                              );
                            }
                          }}
                        />
                        Upload
                      </label>
                    </div>

                    {photoGroup.urls.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-[#9A9AA0] uppercase block mb-1">Uploaded images</span>
                        <div
                          className="bg-white border border-[#EBEBEF] rounded-xl flex flex-col gap-2"
                          style={{ padding: "12px" }}
                        >
                          {photoGroup.urls.map((url, imgIdx) => (
                            <div
                              key={imgIdx}
                              className="flex justify-between items-center bg-[#F7F7F8] rounded-lg border border-[#EBEBEF]"
                              style={{ padding: "8px" }}
                            >
                              <span className="text-[11px] text-[#64646A] truncate max-w-[80%]">{url}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setRoomForm((prev) => {
                                    const list = [...prev.roomPhotos];
                                    list[idx].urls = list[idx].urls.filter((_, i) => i !== imgIdx);
                                    return { ...prev, roomPhotos: list };
                                  });
                                }}
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setRoomForm((prev) => ({
                          ...prev,
                          roomPhotos: prev.roomPhotos.filter((_, i) => i !== idx),
                        }));
                      }}
                      className="rounded-full bg-[#F04646] hover:bg-red-600 text-white  text-[10px] font-bold  mt-1 active:scale-95 transition-all cursor-pointer self-start"
                      style={{ paddingLeft: "12px", paddingRight: "12px", paddingTop: "6px", paddingBottom: "6px" }}
                    >
                      Remove type
                    </button>
                  </div>
                ))}
              </div>

              <input
                type="text"
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px", marginTop: "8px" }}
                placeholder="Address"
                value={roomForm.address}
                onChange={(e) => setRoomForm((prev) => ({ ...prev, address: e.target.value }))}
              />
              <input
                type="text"
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px", marginTop: "8px" }}
                placeholder="Owner phone number"
                value={roomForm.ownerPhone}
                onChange={(e) => setRoomForm((prev) => ({ ...prev, ownerPhone: e.target.value }))}
              />
              <input
                type="text"
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px", marginTop: "8px" }}
                placeholder="Tags (Free WiFi, Food Available, 2 Beds)"
                value={roomForm.tags}
                onChange={(e) => setRoomForm((prev) => ({ ...prev, tags: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3" style={{ marginTop: "8px" }}>
                <input
                  type="number"
                  step="0.000001"
                  className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Latitude"
                  value={roomForm.latitude}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRoomForm((prev) => ({ ...prev, latitude: val }));
                    syncMapMarker(val, roomForm.longitude);
                  }}
                />
                <input
                  type="number"
                  step="0.000001"
                  className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Longitude"
                  value={roomForm.longitude}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRoomForm((prev) => ({ ...prev, longitude: val }));
                    syncMapMarker(roomForm.latitude, val);
                  }}
                />
              </div>

              {/* Map Location Preview */}
              <div className="mt-3">
                <span className="text-xs font-bold text-[#64646A] uppercase block mb-1.5 ml-1">Room Location Preview</span>
                <div id="leaflet-map-container" className="w-full rounded-2xl border border-[#DEDEE2] shadow-xs relative z-10 overflow-hidden" style={{ height: "256px" }} />
                <button
                  type="button"
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${roomForm.latitude},${roomForm.longitude}`, "_blank")}
                  className="w-full bg-[#111111] hover:bg-black text-white rounded-xl text-xs font-semibold active:scale-95 transition-all cursor-pointer shadow-xs"
                  style={{ paddingTop: "12px", paddingBottom: "12px", marginTop: "12px" }}
                >
                  Open in Google Maps
                </button>
                <p className="text-[11px] text-[#9A9AA0] font-bold text-center mt-2">Tap map or drag marker to set room coordinates.</p>
              </div>

              {/* Form buttons */}
              <div className="flex gap-2.5 mt-4">
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 bg-[#ED7D4B] hover:bg-[#EE5B1B] text-white rounded-full font-semibold active:scale-95 transition-all cursor-pointer shadow-sm text-center"
                  style={{ paddingTop: "12px", paddingBottom: "12px" }}
                >
                  {submitLoading ? "..." : roomForm.id ? "Update Room" : "Create Room"}
                </button>
                <button
                  type="button"
                  onClick={() => setRoomForm(initialRoomForm())}
                  className="bg-[#E9E9EC] hover:bg-[#DEDEE2] text-[#33343A] rounded-full font-semibold active:scale-95 transition-all cursor-pointer"
                  style={{ paddingLeft: "32px", paddingRight: "32px", paddingTop: "12px", paddingBottom: "12px" }}
                >
                  Clear
                </button>
              </div>
            </form>
          )}

          {/* SERVICES FORM */}
          {catalogCategory === "services" && (
            <form onSubmit={saveService} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-[#171717]">
                {serviceForm.id ? "Edit Service" : "Add Service"}
              </h2>
              <input
                type="text"
                required
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                placeholder="Service title"
                value={serviceForm.title}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, title: e.target.value }))}
              />
              <textarea
                required
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow min-h-[92px] placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                placeholder="Service description"
                value={serviceForm.description}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <input
                type="number"
                required
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                placeholder="Price"
                value={serviceForm.price}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))}
              />

              <div className="mt-2">
                <span className="text-[11px] font-bold text-[#64646A] uppercase block mb-1.5 ml-1">Service Type</span>
                <div className="flex flex-wrap gap-2 bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl p-2.5">
                  {(["RENT_SCOOTY", "TRIP", "CAMPING", "DRONE_SHOOTING", "OTHER"] as ServiceType[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setServiceForm((prev) => ({ ...prev, type: st }))}
                      className={`rounded-full text-xs font-bold transition-all cursor-pointer`}
                      style={{
                        paddingLeft: "12px",
                        paddingRight: "12px",
                        paddingTop: "6px",
                        paddingBottom: "6px",
                        backgroundColor: serviceForm.type === st ? "#111111" : "#E9E9EC",
                        color: serviceForm.type === st ? "#FFFFFF" : "#33343A",
                      }}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cover Upload */}
              <div>
                <span className="text-[11px] font-bold text-[#64646A] uppercase block mb-1.5 ml-1">Cover Image</span>
                <label
                  className="w-full bg-[#111111] hover:bg-black text-white rounded-xl text-sm font-semibold flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs"
                  style={{ paddingTop: "12px", paddingBottom: "12px" }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        uploadFile(file, (url) => setServiceForm((prev) => ({ ...prev, imageUrl: url })), "serviceCover");
                      }
                    }}
                  />
                  {uploadingField === "serviceCover" ? "..." : "Upload Image"}
                </label>
                {serviceForm.imageUrl && (
                  <div className="mt-2 relative h-24 rounded-xl overflow-hidden border border-gray-200">
                    <img src={serviceForm.imageUrl} alt="Service cover" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>

              <input
                type="text"
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                placeholder="Gallery Image URLs (comma-separated)"
                value={serviceForm.imageUrls}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, imageUrls: e.target.value }))}
              />

              {/* Dynamic Detail Sections list */}
              <div
                className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-2xl mt-2 flex flex-col gap-2"
                style={{ padding: "16px" }}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-[#64646A] uppercase">Detail Sections</span>
                  <button
                    type="button"
                    onClick={() =>
                      setServiceForm((prev) => ({
                        ...prev,
                        detailSections: [...prev.detailSections, { title: "", body: "", items: "" }],
                      }))
                    }
                    className="text-xs font-bold text-[#ED7D4B] hover:underline cursor-pointer"
                  >
                    + Add Section
                  </button>
                </div>
                {serviceForm.detailSections.map((sec, idx) => (
                  <div key={idx} className="mb-4 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-[#111111]">Section #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setServiceForm((prev) => ({
                            ...prev,
                            detailSections: prev.detailSections.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      className="w-full bg-white border border-[#DEDEE2] rounded-lg text-xs text-[#111111]"
                      style={{ paddingLeft: "12px", paddingRight: "12px", paddingTop: "8px", paddingBottom: "8px" }}
                      placeholder="Section Title"
                      value={sec.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setServiceForm((prev) => {
                          const list = [...prev.detailSections];
                          list[idx].title = val;
                          return { ...prev, detailSections: list };
                        });
                      }}
                    />
                    <textarea
                      required
                      className="w-full bg-white border border-[#DEDEE2] rounded-lg text-xs text-[#111111] min-h-[50px]"
                      style={{ paddingLeft: "12px", paddingRight: "12px", paddingTop: "8px", paddingBottom: "8px" }}
                      placeholder="Section Body"
                      value={sec.body}
                      onChange={(e) => {
                        const val = e.target.value;
                        setServiceForm((prev) => {
                          const list = [...prev.detailSections];
                          list[idx].body = val;
                          return { ...prev, detailSections: list };
                        });
                      }}
                    />
                    <input
                      type="text"
                      className="w-full bg-white border border-[#DEDEE2] rounded-lg text-xs text-[#111111]"
                      style={{ paddingLeft: "12px", paddingRight: "12px", paddingTop: "8px", paddingBottom: "8px" }}
                      placeholder="Bullet points (comma-separated)"
                      value={sec.items}
                      onChange={(e) => {
                        const val = e.target.value;
                        setServiceForm((prev) => {
                          const list = [...prev.detailSections];
                          list[idx].items = val;
                          return { ...prev, detailSections: list };
                        });
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Dynamic Activity Options list */}
              <div
                className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-2xl mt-2 flex flex-col gap-2"
                style={{ padding: "16px" }}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-[#64646A] uppercase">Activity Options</span>
                  <button
                    type="button"
                    onClick={() =>
                      setServiceForm((prev) => ({
                        ...prev,
                        activityOptions: [...prev.activityOptions, { id: "", title: "", description: "", pricePerGuest: "" }],
                      }))
                    }
                    className="text-xs font-bold text-[#ED7D4B] hover:underline cursor-pointer"
                  >
                    + Add Option
                  </button>
                </div>
                {serviceForm.activityOptions.map((opt, idx) => (
                  <div key={idx} className="mb-4 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-[#111111]">Option #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setServiceForm((prev) => ({
                            ...prev,
                            activityOptions: prev.activityOptions.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      className="w-full bg-white border border-[#DEDEE2] rounded-lg text-xs text-[#111111]"
                      style={{ paddingLeft: "12px", paddingRight: "12px", paddingTop: "8px", paddingBottom: "8px" }}
                      placeholder="Option Title"
                      value={opt.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setServiceForm((prev) => {
                          const list = [...prev.activityOptions];
                          list[idx].title = val;
                          return { ...prev, activityOptions: list };
                        });
                      }}
                    />
                    <input
                      type="text"
                      className="w-full bg-white border border-[#DEDEE2] rounded-lg text-xs text-[#111111]"
                      style={{ paddingLeft: "12px", paddingRight: "12px", paddingTop: "8px", paddingBottom: "8px" }}
                      placeholder="Option Description"
                      value={opt.description}
                      onChange={(e) => {
                        const val = e.target.value;
                        setServiceForm((prev) => {
                          const list = [...prev.activityOptions];
                          list[idx].description = val;
                          return { ...prev, activityOptions: list };
                        });
                      }}
                    />
                    <input
                      type="number"
                      required
                      className="w-full bg-white border border-[#DEDEE2] rounded-lg text-xs text-[#111111]"
                      style={{ paddingLeft: "12px", paddingRight: "12px", paddingTop: "8px", paddingBottom: "8px" }}
                      placeholder="Price per Guest"
                      value={opt.pricePerGuest}
                      onChange={(e) => {
                        const val = e.target.value;
                        setServiceForm((prev) => {
                          const list = [...prev.activityOptions];
                          list[idx].pricePerGuest = val;
                          return { ...prev, activityOptions: list };
                        });
                      }}
                    />
                  </div>
                ))}
              </div>

              <input
                type="text"
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px", marginTop: "8px" }}
                placeholder="Required documents (comma-separated)"
                value={serviceForm.requiredDocuments}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, requiredDocuments: e.target.value }))}
              />
              <input
                type="text"
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px", marginTop: "8px" }}
                placeholder="Pickup address"
                value={serviceForm.pickupAddress}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, pickupAddress: e.target.value }))}
              />
              <input
                type="text"
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px", marginTop: "8px" }}
                placeholder="Contact phone"
                value={serviceForm.contactPhone}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
              />
              <input
                type="text"
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px", marginTop: "8px" }}
                placeholder="CTA label (e.g. Book experience)"
                value={serviceForm.ctaLabel}
                onChange={(e) => setServiceForm((prev) => ({ ...prev, ctaLabel: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-3" style={{ marginTop: "8px" }}>
                <input
                  type="number"
                  step="0.000001"
                  className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Latitude"
                  value={serviceForm.latitude}
                  onChange={(e) => {
                    const val = e.target.value;
                    setServiceForm((prev) => ({ ...prev, latitude: val }));
                    syncMapMarker(val, serviceForm.longitude);
                  }}
                />
                <input
                  type="number"
                  step="0.000001"
                  className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Longitude"
                  value={serviceForm.longitude}
                  onChange={(e) => {
                    const val = e.target.value;
                    setServiceForm((prev) => ({ ...prev, longitude: val }));
                    syncMapMarker(serviceForm.latitude, val);
                  }}
                />
              </div>

              {/* Map Location Preview */}
              <div className="mt-3">
                <span className="text-xs font-bold text-[#64646A] uppercase block mb-1.5 ml-1">Service Location Preview</span>
                <div id="leaflet-map-container" className="w-full rounded-2xl border border-[#DEDEE2] shadow-xs relative z-10 overflow-hidden" style={{ height: "256px" }} />
                <button
                  type="button"
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${serviceForm.latitude},${serviceForm.longitude}`, "_blank")}
                  className="w-full bg-[#111111] hover:bg-black text-white rounded-xl text-xs font-semibold active:scale-95 transition-all cursor-pointer shadow-xs"
                  style={{ paddingTop: "12px", paddingBottom: "12px", marginTop: "12px" }}
                >
                  Open in Google Maps
                </button>
              </div>

              {/* Form buttons */}
              <div className="flex gap-2.5 mt-4">
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 bg-[#ED7D4B] hover:bg-[#EE5B1B] text-white rounded-full font-semibold active:scale-95 transition-all cursor-pointer shadow-sm text-center"
                  style={{ paddingTop: "12px", paddingBottom: "12px" }}
                >
                  {submitLoading ? "..." : serviceForm.id ? "Update Service" : "Create Service"}
                </button>
                <button
                  type="button"
                  onClick={() => setServiceForm(initialServiceForm())}
                  className="bg-[#E9E9EC] hover:bg-[#DEDEE2] text-[#33343A] rounded-full font-semibold active:scale-95 transition-all cursor-pointer"
                  style={{ paddingLeft: "32px", paddingRight: "32px", paddingTop: "12px", paddingBottom: "12px" }}
                >
                  Clear
                </button>
              </div>
            </form>
          )}

          {/* FOOD & GROCERY FORM */}
          {(catalogCategory === "food" || catalogCategory === "grocery") && (
            <form onSubmit={saveDelivery} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-[#171717]">
                {deliveryForm.id
                  ? `Edit ${catalogCategory === "food" ? "Food Item" : "Grocery Item"}`
                  : `Add ${catalogCategory === "food" ? "Food Item" : "Grocery Item"}`}
              </h2>
              <input
                type="text"
                required
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                placeholder="Item name"
                value={deliveryForm.name}
                onChange={(e) => setDeliveryForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <textarea
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow min-h-[92px] placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                placeholder="Item description"
                value={deliveryForm.description}
                onChange={(e) => setDeliveryForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <input
                type="number"
                required
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                placeholder="Price"
                value={deliveryForm.price}
                onChange={(e) => setDeliveryForm((prev) => ({ ...prev, price: e.target.value }))}
              />

              {/* Image URL + Upload */}
              <div>
                <span className="text-[11px] font-bold text-[#64646A] uppercase block mb-1.5 ml-1">Product Image</span>
                <label
                  className="w-full bg-[#111111] hover:bg-black text-white rounded-xl text-sm font-semibold flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs"
                  style={{ paddingTop: "12px", paddingBottom: "12px" }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        uploadFile(file, (url) => setDeliveryForm((prev) => ({ ...prev, imageUrl: url })), "deliveryCover");
                      }
                    }}
                  />
                  {uploadingField === "deliveryCover" ? "..." : "Upload Image"}
                </label>
                {deliveryForm.imageUrl && (
                  <div className="mt-2 relative h-24 rounded-xl overflow-hidden border border-gray-200">
                    <img src={deliveryForm.imageUrl} alt="Item" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>

              {catalogCategory === "grocery" && (
                <input
                  type="text"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Grocery section (e.g. Dairy / Fruits)"
                  value={deliveryForm.grocerySection}
                  onChange={(e) => setDeliveryForm((prev) => ({ ...prev, grocerySection: e.target.value }))}
                />
              )}

              <input
                type="text"
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                placeholder="Serving info (e.g. Serves 1-2 / Net weight 100g)"
                value={deliveryForm.servingInfo}
                onChange={(e) => setDeliveryForm((prev) => ({ ...prev, servingInfo: e.target.value }))}
              />

              {catalogCategory === "food" && (
                <input
                  type="text"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Serving pieces / portion details (e.g. 2 pieces)"
                  value={deliveryForm.pieces}
                  onChange={(e) => setDeliveryForm((prev) => ({ ...prev, pieces: e.target.value }))}
                />
              )}

              <input
                type="number"
                className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                placeholder="Available quantity"
                value={deliveryForm.availableQuantity}
                onChange={(e) => setDeliveryForm((prev) => ({ ...prev, availableQuantity: e.target.value }))}
              />

              <div className="mt-2 flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  id="isAvailable"
                  checked={deliveryForm.isAvailable}
                  onChange={(e) => setDeliveryForm((prev) => ({ ...prev, isAvailable: e.target.checked }))}
                  className="h-4 w-4 rounded border-[#DEDEE2] text-[#111111] focus:ring-black"
                />
                <label htmlFor="isAvailable" className="text-sm font-semibold text-[#33343A]">
                  Available for Purchase
                </label>
              </div>

              {/* Form buttons */}
              <div className="flex gap-2.5 mt-4">
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 bg-[#ED7D4B] hover:bg-[#EE5B1B] text-white rounded-full font-semibold active:scale-95 transition-all cursor-pointer shadow-sm text-center"
                  style={{ paddingTop: "12px", paddingBottom: "12px" }}
                >
                  {submitLoading ? "..." : deliveryForm.id ? "Update Item" : "Create Item"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryForm(initialDeliveryForm())}
                  className="bg-[#E9E9EC] hover:bg-[#DEDEE2] text-[#33343A] rounded-full font-semibold active:scale-95 transition-all cursor-pointer"
                  style={{ paddingLeft: "32px", paddingRight: "32px", paddingTop: "12px", paddingBottom: "12px" }}
                >
                  Clear
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: Items List Section */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-[#111111] capitalize mb-1">
            {catalogCategory === "rooms"
              ? "Rooms"
              : catalogCategory === "services"
              ? "Services"
              : catalogCategory === "food"
              ? "Food Items"
              : "Grocery Items"}
          </h2>

          {/* Search Input for Food & Grocery items */}
          {(catalogCategory === "food" || catalogCategory === "grocery") && (
            <div className="relative w-full mb-2">
              <input
                type="text"
                placeholder={`Search ${catalogCategory === "food" ? "food" : "grocery"} items...`}
                value={foodSearchQuery}
                onChange={(e) => setFoodSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#DEDEE2] rounded-xl text-sm text-[#111111] input-glow"
                style={{ paddingLeft: "16px", paddingRight: "40px", paddingTop: "12px", paddingBottom: "12px" }}
              />
              {foodSearchQuery && (
                <button
                  type="button"
                  onClick={() => setFoodSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9A9AA0] hover:text-[#111111] cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          {/* Live Delivery Orders Box */}
          {(catalogCategory === "food" || catalogCategory === "grocery") && adminDeliveryOrders.length > 0 && (
            <div
              className="mb-4 rounded-[28px] bg-[#FFFDF6] border-2 border-[#E5B800] shadow-xs"
              style={{ padding: "24px" }}
            >
              <h3 className="text-base font-bold text-[#111111] flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E5B800] animate-pulse" />
                Live Delivery Orders
              </h3>
              <div className="mt-2 divide-y divide-[#EFEFF2]">
                {adminDeliveryOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="pt-3 pb-2 first:pt-1 last:pb-0">
                    <div className="flex justify-between items-center text-sm font-semibold">
                      <span className="text-[#171717]">{order.orderNumber}</span>
                      <span className="text-[#ED7D4B] text-xs font-bold uppercase tracking-wider">
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-[#606066] mt-1.5 leading-relaxed">
                      Customer: {order.user?.name || "Customer"} | {order.customerPhone}
                    </p>
                    <p className="text-xs text-[#8F8F95] mt-0.5">
                      Ordered: {formatDateTime(order.createdAt)}
                    </p>
                    <p className="text-xs text-[#77777D] mt-1 truncate" title={order.deliveryAddress}>
                      {order.deliveryAddress}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="flex-1 bg-[#111111] hover:bg-black text-white text-xs font-semibold rounded-full text-center"
                        style={{ paddingTop: "8px", paddingBottom: "8px" }}
                      >
                        Call Customer
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-xs text-[#64646A] py-6 animate-pulse">Loading catalog...</p>
          ) : (
            <div className="flex flex-col gap-4">
              {catalogCategory === "rooms" &&
                (rooms.length > 0 ? (
                  rooms.map((room) => (
                    <div
                      key={room.id}
                      className="rounded-[28px] bg-white border border-[#EBEBEF] shadow-xs"
                      style={{ padding: "24px", marginBottom: "16px" }}
                    >
                      <h3 className="text-base font-bold text-[#121212]">{room.title}</h3>
                      <p className="text-sm text-[#5F6064] mt-2 leading-relaxed">{room.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {room.tags?.map((t, idx) => (
                          <span
                            key={idx}
                            className="rounded-full bg-[#E9E9EC] text-xs text-[#33343A] font-semibold"
                            style={{ paddingLeft: "12px", paddingRight: "12px", paddingTop: "6px", paddingBottom: "6px" }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm font-bold text-[#1A1A1A] mt-4">INR {room.price}</p>
                      <div className="flex gap-2.5 mt-5 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => handleEditRoom(room)}
                          className="rounded-full bg-[#111111] hover:bg-black text-white text-xs font-semibold transition-all cursor-pointer"
                          style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room.id, room.title)}
                          className="rounded-full bg-[#F04646] hover:bg-red-600 text-white text-xs font-semibold transition-all cursor-pointer"
                          style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px" }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#64646A] py-4">No rooms added yet.</p>
                ))}

              {catalogCategory === "services" &&
                (services.length > 0 ? (
                  services.map((service) => (
                    <div
                      key={service.id}
                      className="rounded-[28px] bg-white border border-[#EBEBEF] shadow-xs"
                      style={{ padding: "24px", marginBottom: "16px" }}
                    >
                      <h3 className="text-base font-bold text-[#121212]">{service.title}</h3>
                      <p className="text-xs text-[#505055] mt-1.5 font-bold">Type: {service.type}</p>
                      <p className="text-sm text-[#5F6064] mt-2 leading-relaxed">{service.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {service.requiredDocuments?.map((doc, idx) => (
                          <span
                            key={idx}
                            className="rounded-full bg-[#E9E9EC] text-xs text-[#33343A] font-semibold"
                            style={{ paddingLeft: "12px", paddingRight: "12px", paddingTop: "6px", paddingBottom: "6px" }}
                          >
                            {doc}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm font-bold text-[#1A1A1A] mt-4">INR {service.price}</p>
                      <div className="flex gap-2.5 mt-5 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => handleEditService(service)}
                          className="rounded-full bg-[#111111] hover:bg-black text-white text-xs font-semibold transition-all cursor-pointer"
                          style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteService(service.id, service.title)}
                          className="rounded-full bg-[#F04646] hover:bg-red-600 text-white text-xs font-semibold transition-all cursor-pointer"
                          style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px" }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#64646A] py-4">No services added yet.</p>
                ))}

              {(catalogCategory === "food" || catalogCategory === "grocery") &&
                (filteredDeliveryItems.length > 0 ? (
                  filteredDeliveryItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[28px] bg-white border border-[#EBEBEF] shadow-xs flex items-start"
                      style={{ padding: "24px", marginBottom: "16px" }}
                    >
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-16 w-16 rounded-2xl object-cover shrink-0 border border-[#EBEBEF]"
                          style={{ marginRight: "16px" }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-[#121212]">{item.name}</h3>
                        <p className="text-sm text-[#5F6064] mt-1 leading-relaxed">{item.description}</p>
                        <p className="text-xs text-[#64646A] mt-1.5 font-bold">
                          Category: {item.category} | Qty: {item.availableQuantity} | {item.isAvailable ? "Available" : "Unavailable"}
                        </p>
                        <p className="text-sm font-bold text-[#1A1A1A] mt-3">INR {item.price}</p>
                        <div className="flex gap-2.5 mt-4 pt-3 border-t border-gray-50">
                          <button
                            onClick={() => handleEditDelivery(item)}
                            className="rounded-full bg-[#111111] hover:bg-black text-white text-xs font-semibold transition-all cursor-pointer"
                            style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "8px", paddingBottom: "8px" }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#64646A] py-4">No products added yet.</p>
                ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
