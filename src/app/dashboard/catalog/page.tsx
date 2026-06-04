"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, Room, Service, DeliveryItem, DeliveryOrder, ServiceType } from "@/lib/api";
import { GlobalCache } from "@/lib/cache";
import { X, CheckCircle2, ShieldAlert, BadgeAlert, MapPin } from "lucide-react";

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
  googleMapUrl: string;
};

type ServiceFormState = {
  id: string | null;
  title: string;
  description: string;
  price: string;
  imageUrl: string;
  imageUrls: string[];
  detailSections: Array<{ title: string; body: string; items: string }>;
  activityOptions: Array<{ id: string; title: string; description: string; pricePerGuest: string }>;
  requiredDocuments: string;
  pickupAddress: string;
  contactPhone: string;
  latitude: string;
  longitude: string;
  ctaLabel: string;
  type: ServiceType;
  googleMapUrl: string;
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
  isVeg: boolean;
};

export default function CatalogPage() {
  const [catalogCategory, setCatalogCategory] = useState<CatalogCategory>("rooms");
  const [loading, setLoading] = useState(!GlobalCache.catalogRooms);

  // Custom dialog modals state
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info" | "warning";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    value: string;
    onConfirm: ((value: string) => void) | null;
  }>({
    isOpen: false,
    title: "",
    placeholder: "",
    value: "",
    onConfirm: null,
  });

  const showAlert = (title: string, message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
    });
  };

  const showPrompt = (title: string, placeholder: string, onConfirm: (value: string) => void) => {
    setPromptModal({
      isOpen: true,
      title,
      placeholder,
      value: "",
      onConfirm,
    });
  };
  const [error, setError] = useState<string | null>(null);
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [adminDeliveryOrders, setAdminDeliveryOrders] = useState<DeliveryOrder[]>([]);

  // Catalog Lists
  const [rooms, setRooms] = useState<Room[]>(GlobalCache.catalogRooms || []);
  const [services, setServices] = useState<Service[]>(GlobalCache.catalogServices || []);
  const [serviceTypes, setServiceTypes] = useState<string[]>(GlobalCache.catalogServiceTypes || []);

  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>(GlobalCache.catalogDeliveryItems || []);

  // Pending counts for badges
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>(GlobalCache.catalogPendingCounts || { rooms: 0, services: 0, food: 0, grocery: 0 });

  // Home Page Icons
  const [homeIcons, setHomeIcons] = useState<{ url: string; public_id: string }[]>(
    GlobalCache.catalogHomeIcons || []
  );

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
    googleMapUrl: "",
  });

  const initialServiceForm = (): ServiceFormState => ({
    id: null,
    title: "",
    description: "",
    price: "",
    imageUrl: "",
    imageUrls: [],
    detailSections: [],
    activityOptions: [],
    requiredDocuments: "",
    pickupAddress: "",
    contactPhone: "",
    latitude: "29.472403",
    longitude: "79.646942",
    ctaLabel: "",
    type: serviceTypes[0] || "RENT_SCOOTY",
    googleMapUrl: "",
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
    isVeg: true,
  });

  const [roomForm, setRoomForm] = useState<RoomFormState>(initialRoomForm());
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(initialServiceForm());
  const [deliveryForm, setDeliveryForm] = useState<DeliveryItemFormState>(initialDeliveryForm());

  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const uploadHeroImageFile = async (file: File) => {
    if (homeIcons.length >= 5) {
      showAlert("Limit Exceeded", "Maximum 5 images allowed.", "warning");
      return;
    }
    setUploadingField("homeIconUpload");
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Str = (reader.result as string).split(",")[1];
          const res = await api.uploadHeroImage(base64Str);
          if (!res?.url || !res?.public_id) {
            throw new Error("Upload failed to return valid image data.");
          }
          setHomeIcons((prev) => {
            const newIcons = [
              ...prev,
              { url: res.url, public_id: res.public_id }
            ].slice(0, 5);
            GlobalCache.catalogHomeIcons = newIcons;
            // Persist to localStorage so icons survive refresh
            try { localStorage.setItem("hero_icons_cache", JSON.stringify(newIcons)); } catch {}
            return newIcons;
          });
          showAlert("Success", "Home page icon uploaded successfully.", "success");
        } catch (err: any) {
          showAlert("Upload Failed", err.message || "Image upload failed.", "error");
        } finally {
          setUploadingField(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingField(null);
    }
  };

  const fetchCatalog = useCallback(async (showPulse = !GlobalCache.catalogRooms) => {
    try {
      if (showPulse) setLoading(true);
      setError(null);

      const [analytics, orders, roomsData, servicesData, dItemsData, iconsData, sTypesData] = await Promise.all([
        api.getAnalytics().catch(() => ({ recentBookings: [] })),
        api.getKitchenOrders().catch(() => []),
        api.getRooms().catch(() => []),
        api.getServices().catch(() => []),
        api.getKitchenItems().catch(() => []),
        api.getHeroImages().catch(() => []),
        api.getServiceTypes().catch(() => ["RENT_SCOOTY", "DRONE_SHOOT", "CAMPING", "TREKKING_WITH_CAMPING", "CAB_AND_TAXI", "CAFE"])
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
      GlobalCache.catalogServiceTypes = sTypesData;
      setServiceTypes(sTypesData);

      // Merge hero images from API with localStorage cache
      // This ensures newly uploaded icons survive refresh even if the integration API hasn't synced yet
      let mergedIcons = iconsData || [];
      try {
        const cached = JSON.parse(localStorage.getItem("hero_icons_cache") || "[]");
        if (Array.isArray(cached) && cached.length > 0) {
          const apiIds = new Set(mergedIcons.map((i: any) => i.public_id));
          const newFromCache = cached.filter((c: any) => c?.url && c?.public_id && !apiIds.has(c.public_id));
          mergedIcons = [...mergedIcons, ...newFromCache].slice(0, 5);
        }
      } catch {}
      // Update localStorage with latest merged state
      try { localStorage.setItem("hero_icons_cache", JSON.stringify(mergedIcons)); } catch {}
      GlobalCache.catalogHomeIcons = mergedIcons;
      setHomeIcons(mergedIcons);

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
      googleMapUrl: room.googleMapUrl || "",
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
      imageUrls: service.imageUrls || [],
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
      googleMapUrl: service.googleMapUrl || "",
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
      pieces: item.pieces || "",
      availableQuantity: item.availableQuantity?.toString() || "100",
      isAvailable: item.isAvailable,
      isVeg: item.isVeg ?? true,
    });
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDeleteRoom = (id: string, title: string) => {
    showConfirm(
      "Delete Room",
      `Are you sure you want to delete room "${title}"?`,
      async () => {
        try {
          await api.deleteRoom(id);
          fetchCatalog();
          showAlert("Success", `Room "${title}" deleted successfully.`, "success");
        } catch (err: any) {
          showAlert("Delete Failed", err.message || "Failed to delete room.", "error");
        }
      }
    );
  };

  const handleDeleteService = (id: string, title: string) => {
    showConfirm(
      "Delete Service",
      `Are you sure you want to delete service "${title}"?`,
      async () => {
        try {
          await api.deleteService(id);
          fetchCatalog();
          showAlert("Success", `Service "${title}" deleted successfully.`, "success");
        } catch (err: any) {
          showAlert("Delete Failed", err.message || "Failed to delete service.", "error");
        }
      }
    );
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
          showAlert("Success", "Image uploaded successfully.", "success");
        } catch (err: any) {
          showAlert("Upload Failed", err.message || "Image upload failed.", "error");
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
        googleMapUrl: roomForm.googleMapUrl || null,
      };

      if (roomForm.id) {
        await api.updateRoom(roomForm.id, payload);
        showAlert("Success", "Room updated successfully.", "success");
      } else {
        await api.createRoom(payload);
        showAlert("Success", "Room created successfully.", "success");
      }
      setRoomForm(initialRoomForm());
      fetchCatalog();
    } catch (err: any) {
      showAlert("Save Failed", err.message || "Failed to save room.", "error");
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
        imageUrls: serviceForm.imageUrls,
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
        googleMapUrl: serviceForm.googleMapUrl || null,
      };

      if (serviceForm.id) {
        await api.updateService(serviceForm.id, payload);
        showAlert("Success", "Service updated successfully.", "success");
      } else {
        await api.createService(payload);
        showAlert("Success", "Service created successfully.", "success");
      }
      setServiceForm(initialServiceForm());
      fetchCatalog();
    } catch (err: any) {
      showAlert("Save Failed", err.message || "Failed to save service.", "error");
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
        description: "",
        price: parseFloat(deliveryForm.price) || 0,
        imageUrl: deliveryForm.imageUrl || null,
        category,
        grocerySection: category === "GROCERY" ? deliveryForm.grocerySection : null,
        servingInfo: deliveryForm.servingInfo || null,
        pieces: category === "FOOD" ? deliveryForm.pieces : null,
        isVeg: category === "FOOD" ? deliveryForm.isVeg : true,
        availableQuantity: parseInt(deliveryForm.availableQuantity) || 0,
        isAvailable: deliveryForm.isAvailable,
      };

      if (deliveryForm.id) {
        await api.updateKitchenItem(deliveryForm.id, payload);
        showAlert("Success", "Item updated successfully.", "success");
      } else {
        await api.createKitchenItem(payload);
        showAlert("Success", "Item created successfully.", "success");
      }
      setDeliveryForm(initialDeliveryForm());
      fetchCatalog();
    } catch (err: any) {
      showAlert("Save Failed", err.message || "Failed to save item.", "error");
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
    <>
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
                  uploadHeroImageFile(file);
                }
              }}
            />
            {uploadingField === "homeIconUpload" ? "..." : "Add Image"}
          </label>
        </div>

        <div className="flex gap-3 overflow-x-auto py-1.5 scrollbar-none">
          {homeIcons
            .filter((img) => img?.url && img?.public_id)
            .map((img, idx) => (
              <div key={img.public_id} className="relative h-20 w-20 rounded-xl overflow-hidden border border-[#EBEBEF] shrink-0 group">
                <img src={img.url} alt={`icon-${idx}`} className="h-full w-full object-cover" />
                <button
                  onClick={() => {
                    showConfirm(
                      "Delete Icon",
                      "Are you sure you want to delete this icon?",
                      async () => {
                        setUploadingField("homeIconUpload");
                        try {
                          await api.deleteHeroImage(img.public_id);
                          setHomeIcons((prev) => {
                            const newIcons = prev.filter((icon) => icon.public_id !== img.public_id);
                            GlobalCache.catalogHomeIcons = newIcons;
                            try { localStorage.setItem("hero_icons_cache", JSON.stringify(newIcons)); } catch {}
                            return newIcons;
                          });
                          showAlert("Success", "Home page icon deleted successfully.", "success");
                        } catch (err: any) {
                          showAlert("Delete Failed", err.message || "Failed to delete image.", "error");
                        } finally {
                          setUploadingField(null);
                        }
                      }
                    );
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
        className="flex overflow-x-auto gap-1 rounded-full bg-white border border-[#EBEBEF] shadow-sm p-1 self-start max-w-full scrollbar-none"
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
              className={`relative rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
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
          className="rounded-[28px] bg-white border border-[#EBEBEF] shadow-sm p-4 sm:p-6 md:p-8"
        >
          {catalogCategory === "rooms" && (
            <form onSubmit={saveRoom} className="flex flex-col gap-4">
              <h2 className="text-xl font-bold text-[#171717]">
                {roomForm.id ? "Edit Room" : "Add Room"}
              </h2>
              
              <div className="flex flex-col gap-1.5">
                <label htmlFor="room-title" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Room Title</label>
                <input
                  id="room-title"
                  type="text"
                  required
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Room title"
                  value={roomForm.title}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="room-description" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Room Description</label>
                <textarea
                  id="room-description"
                  required
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow min-h-[92px] placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Room description"
                  value={roomForm.description}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="room-price" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Price (INR)</label>
                  <input
                    id="room-price"
                    type="number"
                    required
                    className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                    style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                    placeholder="Price"
                    value={roomForm.price}
                    onChange={(e) => setRoomForm((prev) => ({ ...prev, price: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="room-capacity" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Capacity (Guests)</label>
                  <input
                    id="room-capacity"
                    type="number"
                    required
                    className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                    style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                    placeholder="Capacity"
                    value={roomForm.capacity}
                    onChange={(e) => setRoomForm((prev) => ({ ...prev, capacity: e.target.value }))}
                  />
                </div>
              </div>

              {/* Cover image upload */}
              <div>
                <label className="text-xs font-bold text-[#64646A] uppercase block mb-1.5 ml-1">Main Room Image</label>
                {roomForm.imageUrl ? (
                  <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-[#EBEBEF] shrink-0 shadow-xs">
                    <img src={roomForm.imageUrl} alt="Room cover" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setRoomForm((prev) => ({ ...prev, imageUrl: "" }))}
                      className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black text-white p-1 rounded-full active:scale-90 transition-all cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="room-cover-upload"
                    className="w-full bg-[#111111] hover:bg-black text-white rounded-[24px] text-sm font-semibold flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs"
                    style={{ paddingTop: "12px", paddingBottom: "12px" }}
                  >
                    <input
                      id="room-cover-upload"
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
                )}
              </div>

              {/* Photos dynamic container */}
              <div className="mt-2 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-bold text-[#111111]">Room photos</span>
                  <button
                    type="button"
                    onClick={() => {
                      showPrompt(
                        "Add Photo Type",
                        "Enter new photo area type (e.g. Balcony, Private Kitchen):",
                        (newType) => {
                          if (newType.trim()) {
                            setRoomForm((prev) => ({
                              ...prev,
                              roomPhotos: [...prev.roomPhotos, { type: newType.trim(), urls: [] }],
                            }));
                          }
                        }
                      );
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
                        <label htmlFor={`room-photo-type-${idx}`} className="text-[10px] font-bold text-[#9A9AA0] uppercase block mb-1">Photo type</label>
                        <input
                          id={`room-photo-type-${idx}`}
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
                        <span className="text-[10px] font-bold text-[#9A9AA0] uppercase block mb-1.5 ml-1">Uploaded images</span>
                        <div className="flex flex-wrap gap-2.5 bg-white border border-[#EBEBEF] rounded-lg" style={{ padding: "12px" }}>
                          {photoGroup.urls.map((url, imgIdx) => (
                            <div key={imgIdx} className="relative h-16 w-16 rounded-lg overflow-hidden border border-[#EBEBEF] shrink-0 group shadow-xs">
                              <img src={url} alt={`room-photo-${imgIdx}`} className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => {
                                  setRoomForm((prev) => {
                                    const list = [...prev.roomPhotos];
                                    list[idx].urls = list[idx].urls.filter((_, i) => i !== imgIdx);
                                    return { ...prev, roomPhotos: list };
                                  });
                                }}
                                className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white p-1 rounded-full active:scale-90 transition-all cursor-pointer"
                              >
                                <X size={8} />
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

              <div className="flex flex-col gap-1.5 mt-2">
                <label htmlFor="room-address" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Address</label>
                <input
                  id="room-address"
                  type="text"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Address"
                  value={roomForm.address}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label htmlFor="room-map-url" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Google Map Redirect URL</label>
                <input
                  id="room-map-url"
                  type="text"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="e.g. https://maps.app.goo.gl/..."
                  value={roomForm.googleMapUrl}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, googleMapUrl: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label htmlFor="room-owner-phone" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Owner Phone Number</label>
                <input
                  id="room-owner-phone"
                  type="text"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Owner phone number"
                  value={roomForm.ownerPhone}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, ownerPhone: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label htmlFor="room-tags" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Tags (comma-separated)</label>
                <input
                  id="room-tags"
                  type="text"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Tags (Free WiFi, Food Available, 2 Beds)"
                  value={roomForm.tags}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, tags: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="room-latitude" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Latitude</label>
                  <input
                    id="room-latitude"
                    type="number"
                    step="0.000001"
                    className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                    style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                    placeholder="Latitude"
                    value={roomForm.latitude}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRoomForm((prev) => ({ ...prev, latitude: val }));
                      syncMapMarker(val, roomForm.longitude);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="room-longitude" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Longitude</label>
                  <input
                    id="room-longitude"
                    type="number"
                    step="0.000001"
                    className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
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
              </div>

              {/* Map Location Preview */}
              <div className="mt-3">
                <span className="text-xs font-bold text-[#64646A] uppercase block mb-1.5 ml-1">Room Location Preview</span>
                <div id="leaflet-map-container" className="w-full rounded-2xl border border-[#DEDEE2] shadow-xs relative z-10 overflow-hidden" style={{ height: "256px" }} />
                <button
                  type="button"
                  onClick={() => window.open(roomForm.googleMapUrl || `https://www.google.com/maps/search/?api=1&query=${roomForm.latitude},${roomForm.longitude}`, "_blank")}
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

              <div className="flex flex-col gap-1.5">
                <label htmlFor="service-title" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Service Title</label>
                <input
                  id="service-title"
                  type="text"
                  required
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Service title"
                  value={serviceForm.title}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="service-description" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Service Description</label>
                <textarea
                  id="service-description"
                  required
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow min-h-[92px] placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Service description"
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="service-price" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Price (INR)</label>
                <input
                  id="service-price"
                  type="number"
                  required
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Price"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))}
                />
              </div>

              <div className="mt-2">
                <span className="text-[11px] font-bold text-[#64646A] uppercase block mb-1.5 ml-1">Service Type</span>
                <div className="flex flex-wrap gap-2 bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl p-2.5">
                  {(serviceTypes.length > 0 ? serviceTypes : ["RENT_SCOOTY", "DRONE_SHOOT", "CAMPING", "TREKKING_WITH_CAMPING", "CAB_AND_TAXI", "CAFE"]).map((st) => (
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
                      {st.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cover Upload */}
              <div>
                <label className="text-xs font-bold text-[#64646A] uppercase block mb-1.5 ml-1">Cover Image</label>
                {serviceForm.imageUrl ? (
                  <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-[#EBEBEF] shrink-0 shadow-xs">
                    <img src={serviceForm.imageUrl} alt="Service cover" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setServiceForm((prev) => ({ ...prev, imageUrl: "" }))}
                      className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black text-white p-1 rounded-full active:scale-90 transition-all cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="service-cover-upload"
                    className="w-full bg-[#111111] hover:bg-black text-white rounded-xl text-sm font-semibold flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs"
                    style={{ paddingTop: "12px", paddingBottom: "12px" }}
                  >
                    <input
                      id="service-cover-upload"
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
                )}
              </div>

              {/* Service Gallery Images */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-[#64646A] uppercase block ml-1">Gallery Images</label>
                  {serviceForm.imageUrls.length < 10 && (
                    <label className="text-xs font-bold text-[#ED7D4B] hover:underline cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            uploadFile(
                              file,
                              (url) => setServiceForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, url] })),
                              "serviceGalleryUpload"
                            );
                          }
                        }}
                      />
                      {uploadingField === "serviceGalleryUpload" ? "..." : "+ Add Image"}
                    </label>
                  )}
                </div>

                {serviceForm.imageUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5 bg-white border border-[#EBEBEF] rounded-lg p-3">
                    {serviceForm.imageUrls.map((url, imgIdx) => (
                      <div key={imgIdx} className="relative h-16 w-16 rounded-lg overflow-hidden border border-[#EBEBEF] shrink-0 group shadow-xs">
                        <img src={url} alt={`service-gallery-${imgIdx}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setServiceForm((prev) => ({
                              ...prev,
                              imageUrls: prev.imageUrls.filter((_, i) => i !== imgIdx),
                            }));
                          }}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white p-1 rounded-full active:scale-90 transition-all cursor-pointer"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#9A9AA0] italic ml-1">No gallery images uploaded yet.</p>
                )}
              </div>

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
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`sec-title-${idx}`} className="text-[10px] font-bold text-[#9A9AA0] uppercase block">Title</label>
                      <input
                        id={`sec-title-${idx}`}
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
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`sec-body-${idx}`} className="text-[10px] font-bold text-[#9A9AA0] uppercase block">Body</label>
                      <textarea
                        id={`sec-body-${idx}`}
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
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`sec-items-${idx}`} className="text-[10px] font-bold text-[#9A9AA0] uppercase block">Bullet points (comma-separated)</label>
                      <input
                        id={`sec-items-${idx}`}
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
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`opt-title-${idx}`} className="text-[10px] font-bold text-[#9A9AA0] uppercase block">Title</label>
                      <input
                        id={`opt-title-${idx}`}
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
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`opt-desc-${idx}`} className="text-[10px] font-bold text-[#9A9AA0] uppercase block">Description</label>
                      <input
                        id={`opt-desc-${idx}`}
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
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`opt-price-${idx}`} className="text-[10px] font-bold text-[#9A9AA0] uppercase block">Price per Guest</label>
                      <input
                        id={`opt-price-${idx}`}
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
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label htmlFor="service-required-docs" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Required documents (comma-separated)</label>
                <input
                  id="service-required-docs"
                  type="text"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Required documents (comma-separated)"
                  value={serviceForm.requiredDocuments}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, requiredDocuments: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label htmlFor="service-pickup-address" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Pickup Address</label>
                <input
                  id="service-pickup-address"
                  type="text"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Pickup address"
                  value={serviceForm.pickupAddress}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, pickupAddress: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label htmlFor="service-map-url" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Google Map Redirect URL</label>
                <input
                  id="service-map-url"
                  type="text"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="e.g. https://maps.app.goo.gl/..."
                  value={serviceForm.googleMapUrl}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, googleMapUrl: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label htmlFor="service-contact-phone" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Contact Phone</label>
                <input
                  id="service-contact-phone"
                  type="text"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Contact phone"
                  value={serviceForm.contactPhone}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label htmlFor="service-cta-label" className="text-xs font-bold text-[#64646A] uppercase block ml-1">CTA label (e.g. Book experience)</label>
                <input
                  id="service-cta-label"
                  type="text"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="CTA label (e.g. Book experience)"
                  value={serviceForm.ctaLabel}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="service-latitude" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Latitude</label>
                  <input
                    id="service-latitude"
                    type="number"
                    step="0.000001"
                    className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                    style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                    placeholder="Latitude"
                    value={serviceForm.latitude}
                    onChange={(e) => {
                      const val = e.target.value;
                      setServiceForm((prev) => ({ ...prev, latitude: val }));
                      syncMapMarker(val, serviceForm.longitude);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="service-longitude" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Longitude</label>
                  <input
                    id="service-longitude"
                    type="number"
                    step="0.000001"
                    className="bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
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
              </div>

              {/* Map Location Preview */}
              <div className="mt-3">
                <span className="text-xs font-bold text-[#64646A] uppercase block mb-1.5 ml-1">Service Location Preview</span>
                <div id="leaflet-map-container" className="w-full rounded-2xl border border-[#DEDEE2] shadow-xs relative z-10 overflow-hidden" style={{ height: "256px" }} />
                <button
                  type="button"
                  onClick={() => window.open(serviceForm.googleMapUrl || `https://www.google.com/maps/search/?api=1&query=${serviceForm.latitude},${serviceForm.longitude}`, "_blank")}
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
              
              <div className="flex flex-col gap-1.5">
                <label htmlFor="delivery-name" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Item Name</label>
                <input
                  id="delivery-name"
                  type="text"
                  required
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Item name"
                  value={deliveryForm.name}
                  onChange={(e) => setDeliveryForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>


              <div className="flex flex-col gap-1.5">
                <label htmlFor="delivery-price" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Price (INR)</label>
                <input
                  id="delivery-price"
                  type="number"
                  required
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Price"
                  value={deliveryForm.price}
                  onChange={(e) => setDeliveryForm((prev) => ({ ...prev, price: e.target.value }))}
                />
              </div>

              {catalogCategory === "food" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-[#64646A] uppercase block ml-1">Food Type</span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDeliveryForm((prev) => ({ ...prev, isVeg: true }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-semibold text-sm transition-all cursor-pointer ${
                        deliveryForm.isVeg
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs"
                          : "bg-[#F7F7F8] border-[#DEDEE2] text-[#64646A] hover:bg-[#EFEFF2]"
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full bg-emerald-500 border border-emerald-600 flex items-center justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                      Veg
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryForm((prev) => ({ ...prev, isVeg: false }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-semibold text-sm transition-all cursor-pointer ${
                        !deliveryForm.isVeg
                          ? "bg-red-50 border-red-500 text-red-700 shadow-xs"
                          : "bg-[#F7F7F8] border-[#DEDEE2] text-[#64646A] hover:bg-[#EFEFF2]"
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full bg-red-600 border border-red-700 flex items-center justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                      Non-Veg
                    </button>
                  </div>
                </div>
              )}

              {/* Image URL + Upload */}
              <div>
                <label className="text-xs font-bold text-[#64646A] uppercase block mb-1.5 ml-1">Product Image</label>
                {deliveryForm.imageUrl ? (
                  <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-[#EBEBEF] shrink-0 shadow-xs">
                    <img src={deliveryForm.imageUrl} alt="Item" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setDeliveryForm((prev) => ({ ...prev, imageUrl: "" }))}
                      className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black text-white p-1 rounded-full active:scale-90 transition-all cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="delivery-cover-upload"
                    className="w-full bg-[#111111] hover:bg-black text-white rounded-xl text-sm font-semibold flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs"
                    style={{ paddingTop: "12px", paddingBottom: "12px" }}
                  >
                    <input
                      id="delivery-cover-upload"
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
                )}
              </div>

              {catalogCategory === "grocery" && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="delivery-section" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Grocery section (e.g. Dairy / Fruits)</label>
                  <input
                    id="delivery-section"
                    type="text"
                    className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                    style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                    placeholder="Grocery section (e.g. Dairy / Fruits)"
                    value={deliveryForm.grocerySection}
                    onChange={(e) => setDeliveryForm((prev) => ({ ...prev, grocerySection: e.target.value }))}
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="delivery-serving-info" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Serving info (e.g. Serves 1-2 / Net weight 100g)</label>
                <input
                  id="delivery-serving-info"
                  type="text"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Serving info (e.g. Serves 1-2 / Net weight 100g)"
                  value={deliveryForm.servingInfo}
                  onChange={(e) => setDeliveryForm((prev) => ({ ...prev, servingInfo: e.target.value }))}
                />
              </div>

              {catalogCategory === "food" && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="delivery-pieces" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Serving pieces / portion details (e.g. 2 pieces)</label>
                  <input
                    id="delivery-pieces"
                    type="text"
                    className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                    style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                    placeholder="Serving pieces / portion details (e.g. 2 pieces)"
                    value={deliveryForm.pieces}
                    onChange={(e) => setDeliveryForm((prev) => ({ ...prev, pieces: e.target.value }))}
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="delivery-quantity" className="text-xs font-bold text-[#64646A] uppercase block ml-1">Available quantity</label>
                <input
                  id="delivery-quantity"
                  type="number"
                  className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow placeholder:text-[#9A9AA0]"
                  style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "12px", paddingBottom: "12px" }}
                  placeholder="Available quantity"
                  value={deliveryForm.availableQuantity}
                  onChange={(e) => setDeliveryForm((prev) => ({ ...prev, availableQuantity: e.target.value }))}
                />
              </div>

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
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="bg-[#ED7D4B] hover:bg-[#EE5B1B] text-white rounded-full font-semibold active:scale-95 transition-all cursor-pointer text-center"
                  style={{ paddingTop: "12px", paddingBottom: "12px" }}
                >
                  {submitLoading ? "..." : deliveryForm.id ? "Update Item" : "Create Item"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryForm(initialDeliveryForm())}
                  className="bg-[#E9E9EC] hover:bg-[#DEDEE2] text-[#33343A] rounded-full font-semibold active:scale-95 transition-all cursor-pointer"
                  style={{ paddingTop: "12px", paddingBottom: "12px" }}
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
                className="w-full bg-white border border-[#DEDEE2] rounded-lg text-sm text-[#111111] input-glow"
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
                      className="rounded-[28px] bg-white border border-[#EBEBEF] shadow-xs p-4 sm:p-6"
                      style={{ marginBottom: "16px" }}
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
                      <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-100">
                        <p className="text-sm font-bold text-[#1A1A1A]">INR {room.price}</p>
                        <div className="flex gap-2.5">
                          {room.googleMapUrl && (
                            <a
                              href={room.googleMapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                              style={{ paddingLeft: "14px", paddingRight: "14px", paddingTop: "8px", paddingBottom: "8px" }}
                            >
                              <MapPin size={14} />
                              <span>Map</span>
                            </a>
                          )}
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
                      className="rounded-[28px] bg-white border border-[#EBEBEF] shadow-xs p-4 sm:p-6"
                      style={{ marginBottom: "16px" }}
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
                      <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-100">
                        <p className="text-sm font-bold text-[#1A1A1A]">INR {service.price}</p>
                        <div className="flex gap-2.5">
                          {service.googleMapUrl && (
                            <a
                              href={service.googleMapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                              style={{ paddingLeft: "14px", paddingRight: "14px", paddingTop: "8px", paddingBottom: "8px" }}
                            >
                              <MapPin size={14} />
                              <span>Map</span>
                            </a>
                          )}
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
                      className="rounded-[28px] bg-white border border-[#EBEBEF] shadow-xs flex items-start p-4 sm:p-6"
                      style={{ marginBottom: "16px" }}
                    >
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-16 w-16 rounded-xl object-cover shrink-0 border border-[#EBEBEF]"
                          style={{ marginRight: "16px" }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-[#121212] flex items-center gap-2">
                          {item.category === "FOOD" && (
                            <span className={`inline-flex items-center justify-center h-4 w-4 border-2 shrink-0 ${item.isVeg ? "border-emerald-500" : "border-red-600"}`} style={{ padding: '2px' }}>
                              <span className={`h-1.5 w-1.5 rounded-full ${item.isVeg ? "bg-emerald-500" : "bg-red-600"}`} />
                            </span>
                          )}
                          {item.name}
                        </h3>
                        <p className="text-xs text-[#64646A] mt-1.5 font-semibold">
                          Category: {item.category} | Qty: {item.availableQuantity} | {item.isAvailable ? "Available" : "Unavailable"}
                        </p>
                        {(item.servingInfo || item.pieces) && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.servingInfo && (
                              <span className="bg-gray-50 border border-gray-100 text-[#5F6064] text-[10px] px-2.5 py-0.5 rounded-md">
                                {item.servingInfo}
                              </span>
                            )}
                            {item.pieces && (
                              <span className="bg-gray-50 border border-gray-100 text-[#5F6064] text-[10px] px-2.5 py-0.5 rounded-md">
                                {item.pieces}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                          <p className="text-sm font-bold text-[#1A1A1A]">INR {item.price}</p>
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

    {/* Custom Dialog Modals */}
    {alertModal.isOpen && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-fade-in shadow-xl flex flex-col gap-4 text-center">
          <div className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center ${
            alertModal.type === "success" ? "bg-emerald-50 text-emerald-500" :
            alertModal.type === "error" ? "bg-red-50 text-red-500" :
            alertModal.type === "warning" ? "bg-amber-50 text-amber-500" :
            "bg-blue-50 text-blue-500"
          }`}>
            {alertModal.type === "success" ? <CheckCircle2 size={24} /> :
             alertModal.type === "error" ? <BadgeAlert size={24} /> :
             alertModal.type === "warning" ? <ShieldAlert size={24} /> :
             <ShieldAlert size={24} className="text-blue-500" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#111111]">{alertModal.title}</h3>
            <p className="text-xs text-[#66666A] mt-2 leading-relaxed">{alertModal.message}</p>
          </div>
          <button
            onClick={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
            className="w-full bg-[#111111] hover:bg-black text-white font-semibold py-3 rounded-full text-xs active:scale-95 transition-all cursor-pointer"
          >
            Okay
          </button>
        </div>
      </div>
    )}

    {confirmModal.isOpen && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-fade-in shadow-xl flex flex-col gap-4 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#111111]">{confirmModal.title}</h3>
            <p className="text-xs text-[#66666A] mt-2 leading-relaxed">{confirmModal.message}</p>
          </div>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
              className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-[#66666A] font-semibold py-2.5 rounded-full text-xs active:scale-95 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                if (confirmModal.onConfirm) confirmModal.onConfirm();
              }}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-full text-xs active:scale-95 transition-all cursor-pointer"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    )}

    {promptModal.isOpen && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-fade-in shadow-xl flex flex-col gap-4">
          <h3 className="text-base font-bold text-[#111111] text-center">{promptModal.title}</h3>
          <input
            type="text"
            placeholder={promptModal.placeholder}
            value={promptModal.value}
            onChange={(e) => setPromptModal((prev) => ({ ...prev, value: e.target.value }))}
            className="w-full bg-[#F7F7F8] border border-[#DEDEE2] rounded-xl text-sm text-[#111111] px-4 py-2.5 input-glow placeholder:text-[#9A9AA0]"
            autoFocus
          />
          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={() => setPromptModal((prev) => ({ ...prev, isOpen: false }))}
              className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-[#66666A] font-semibold py-2.5 rounded-full text-xs active:scale-95 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setPromptModal((prev) => ({ ...prev, isOpen: false }));
                if (promptModal.onConfirm) promptModal.onConfirm(promptModal.value);
              }}
              className="flex-1 bg-[#111111] hover:bg-black text-white font-bold py-2.5 rounded-full text-xs active:scale-95 transition-all cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
