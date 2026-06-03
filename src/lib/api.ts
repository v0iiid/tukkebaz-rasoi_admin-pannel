export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://tukkabaz-backend.onrender.com";

// Type definitions matching Prisma / Express backend payloads

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: "ADMIN" | "VENDOR" | "DELIVERY" | "CUSTOMER";
  picture?: string | null;
}

export interface Booking {
  id: string;
  userId: string;
  roomId?: string | null;
  serviceId?: string | null;
  kind: "ROOM" | "SERVICE";
  quantity: number;
  amount: number;
  paymentProvider: string;
  paymentReference?: string | null;
  paymentStatus: "PENDING" | "SUCCESS" | "FAILED";
  activityOptions: any[];
  bookedFor?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  room?: Room | null;
  service?: Service | null;
}

export interface AnalyticsSummary {
  totalBookings: number;
  successfulBookings: number;
  roomsPurchased: number;
  servicesPurchased: number;
  totalRevenue: number;
}

export interface RoomBreakdown {
  roomId: string;
  title: string;
  count: number;
  revenue: number;
}

export interface ServiceBreakdown {
  serviceId: string;
  title: string;
  type: string;
  count: number;
  revenue: number;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  roomBreakdown: RoomBreakdown[];
  serviceBreakdown: ServiceBreakdown[];
  recentBookings: Booking[];
}

export interface RoomPhoto {
  url?: string;
  urls?: string[];
  type: string;
}

export interface Room {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  imageUrls: string[];
  roomPhotoTypes: string[];
  roomPhotos: RoomPhoto[];
  address?: string | null;
  ownerPhone?: string | null;
  tags: string[];
  amenities: string[];
  unavailableAmenities: string[];
  sleepTitle?: string | null;
  sleepDescription?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capacity: number;
  available: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceDetailSection {
  title: string;
  body?: string;
  items?: string[];
}

export interface ServiceActivityOption {
  id?: string;
  title: string;
  description?: string;
  pricePerGuest: number;
}

export type ServiceType = "RENT_SCOOTY" | "TRIP" | "CAMPING" | "DRONE_SHOOTING" | "OTHER";

export interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  imageUrls: string[];
  type: ServiceType;
  detailSections: ServiceDetailSection[];
  activityOptions: ServiceActivityOption[];
  requiredDocuments: string[];
  pickupAddress?: string | null;
  contactPhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ctaLabel?: string | null;
  available: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Delivery structures (Tukkabz Rasoi)
export interface DeliveryItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  category: "FOOD" | "GROCERY";
  grocerySection?: string | null;
  servingInfo?: string | null;
  isAvailable: boolean;
  availableQuantity: number;
}

export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  userId: string;
  items: any; // Array of items and quantities
  totalAmount: number;
  paymentStatus: "PENDING" | "SUCCESS" | "FAILED";
  status: "PENDING" | "ACCEPTED" | "PREPARING" | "READY_FOR_PICKUP" | "PICKED_UP" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
  deliveryAddress: string;
  customerPhone: string;
  partnerId?: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
  partner?: DeliveryPartner | null;
}

export interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  isAvailable: boolean;
  currentOrderId?: string | null;
  currentLat?: number | null;
  currentLng?: number | null;
  dlUrl?: string | null;
  profileStatus?: "INCOMPLETE" | "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED" | null;
  profilePhotoUrl?: string | null;
  upiId?: string | null;
  unpaidAmount?: number | null;
}

export interface PartnerPayoutRequest {
  id: string;
  name: string;
  phone: string;
  upiId?: string | null;
  unpaidAmount: number;
}

// Token helper functions
export const getAdminToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("admin_token");
  }
  return null;
};

export const setAdminToken = (token: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("admin_token", token);
  }
};

export const removeAdminToken = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
  }
};

export const getAdminUser = (): User | null => {
  if (typeof window !== "undefined") {
    const userStr = localStorage.getItem("admin_user");
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
  }
  return null;
};

export const setAdminUser = (user: User): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("admin_user", JSON.stringify(user));
  }
};

// Generic Fetch Wrapper
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAdminToken();

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const config: RequestInit = {
    ...options,
    headers,
    signal: controller.signal,
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error("Request timed out. Please check your connection or try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  let data: any = {};
  try {
    data = await response.json();
  } catch (err) {
    // safe fallback if response is not JSON
  }

  if (!response.ok) {
    if (response.status === 401 && endpoint !== "/admin/login") {
      removeAdminToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login?expired=true";
      }
    }
    throw new Error(data.message || data.error || `HTTP error ${response.status}`);
  }

  if (data.success === false) {
    throw new Error(data.message || data.error || "Request failed");
  }

  // Handle standard success wrapper from backend: { success: true, data: ... }
  if (data.success && data.data !== undefined) {
    return data.data as T;
  }

  return data as T;
}

// API Services
export const api = {
  // Auth
  async login(payload: any) {
    const data = await request<{ user: User; accessToken: string; refreshToken: string }>(
      "/admin/login",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    setAdminToken(data.accessToken);
    setAdminUser(data.user);
    return data;
  },

  // Analytics
  async getAnalytics() {
    return request<AnalyticsResponse>("/admin/analytics");
  },

  // Rooms CRUD
  async getRooms() {
    const data = await request<{ rooms: Room[] }>("/admin/rooms");
    return data.rooms;
  },

  async createRoom(payload: Partial<Room>) {
    return request<Room>("/admin/rooms", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateRoom(id: string, payload: Partial<Room>) {
    return request<Room>(`/admin/rooms/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async deleteRoom(id: string) {
    return request<{ message: string }>(`/admin/rooms/${id}`, {
      method: "DELETE",
    });
  },

  // Upload Images
  async uploadImage(imageBase64: string, fileName?: string) {
    return request<{ url: string; public_id: string }>("/admin/uploads/image", {
      method: "POST",
      body: JSON.stringify({ imageBase64, fileName, folder: "tukkabaz_rasoi" }),
    });
  },

  // Services CRUD
  async getServices() {
    const data = await request<{ services: Service[] }>("/admin/services");
    return data.services;
  },

  async createService(payload: Partial<Service>) {
    return request<Service>("/admin/services", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateService(id: string, payload: Partial<Service>) {
    return request<Service>(`/admin/services/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async deleteService(id: string) {
    return request<{ message: string }>(`/admin/services/${id}`, {
      method: "DELETE",
    });
  },

  // Kitchen / Delivery Items (Tukkabz Rasoi)
  async getKitchenItems() {
    const data = await request<{ items: DeliveryItem[] }>("/delivery/kitchen/items");
    return data.items;
  },

  async createKitchenItem(payload: Partial<DeliveryItem>) {
    return request<DeliveryItem>("/delivery/kitchen/items", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateKitchenItem(id: string, payload: Partial<DeliveryItem>) {
    return request<DeliveryItem>(`/delivery/kitchen/items/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async updateItemInventory(id: string, payload: { isAvailable: boolean; availableQuantity: number }) {
    return request<DeliveryItem>(`/delivery/kitchen/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  // Delivery Orders
  async getKitchenOrders() {
    const data = await request<{ orders: DeliveryOrder[] }>("/delivery/kitchen/orders");
    return data.orders;
  },

  async updateOrderStatus(id: string, status: string) {
    return request<DeliveryOrder>(`/delivery/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async getAvailablePartners() {
    const data = await request<{ partners: DeliveryPartner[] }>("/delivery/partners/available");
    return data.partners;
  },

  async assignPartnerToOrder(orderId: string, partnerId: string) {
    return request<DeliveryOrder>(`/delivery/orders/${orderId}/assign-partner`, {
      method: "PATCH",
      body: JSON.stringify({ partnerId }),
    });
  },

  // Delivery Partners Admin Operations
  async getPendingPartners() {
    const data = await request<{ partners: DeliveryPartner[] }>("/delivery/admin/partners/pending");
    return data.partners;
  },

  async adminGetAllPartners() {
    const data = await request<{ partners: DeliveryPartner[] }>("/delivery/admin/partners");
    return data.partners;
  },

  async verifyPartner(partnerId: string, status: "APPROVED" | "REJECTED") {
    return request<{ message: string; partner: DeliveryPartner }>(`/delivery/admin/partners/${partnerId}/verify`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  // Partner Payouts Admin Operations
  async getPendingPayoutRequests() {
    const data = await request<{ requests: PartnerPayoutRequest[] }>("/admin/partner-payouts");
    return data.requests;
  },

  async clearPartnerPayout(partnerId: string, utrNumber: string) {
    return request<{ message: string }>(`/admin/partner-payouts/${partnerId}/clear`, {
      method: "POST",
      body: JSON.stringify({ utrNumber }),
    });
  },

  // Settings
  async getHomeIcons() {
    const data = await request<{ icons?: string[] }>("/admin/settings/home-icons");
    return data.icons || [];
  },

  async updateHomeIcons(icons: string[]) {
    return request<{ icons: string[] }>("/admin/settings/home-icons", {
      method: "PUT",
      body: JSON.stringify({ icons }),
    });
  },

  // Hero Images (Home Page Icons) synced with Vercel & Backend Cloudinary
  async getHeroImages() {
    const res = await fetch("/api/hero");
    if (!res.ok) {
      throw new Error(`Failed to fetch hero images: ${res.status}`);
    }
    const json = await res.json();
    return (json.images || []) as { url: string; public_id: string }[];
  },

  async uploadHeroImage(imageBase64: string) {
    return request<{ url: string; public_id: string }>("/admin/media/upload", {
      method: "POST",
      body: JSON.stringify({ image: `data:image/jpeg;base64,${imageBase64}` }),
    });
  },

  async deleteHeroImage(public_id: string) {
    return request<{ message: string; public_id: string }>(`/admin/media/${public_id}`, {
      method: "DELETE",
    });
  }
};
