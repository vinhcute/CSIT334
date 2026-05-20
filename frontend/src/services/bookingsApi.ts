import { createApiClient } from "./apiClient.js";
import type { ParkingSpotStatus } from "./parkingSpotsApi.js";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "expired" | "completed";

export interface BookingSpotSummary {
  id: string;
  zoneId: string;
  spotCode: string;
  status: ParkingSpotStatus;
  level: string | null;
  rowLabel: string | null;
  zone: {
    id: string;
    name: string;
    distanceFromEntryMeters: number | null;
    displayOrder: number;
  };
}

export interface BookingUserSummary {
  id: string;
  name: string | null;
  email: string;
  role: "driver" | "admin";
  accountStatus: "active" | "disabled" | "pending";
}

export interface BookingSummary {
  id: string;
  userId: string;
  spotId: string;
  status: BookingStatus;
  startTime: string;
  endTime: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  spot: BookingSpotSummary;
}

export interface BookingDetail extends BookingSummary {
  user?: BookingUserSummary;
}

export interface CreateBookingRequest {
  spotId: string;
  startTime: string;
  endTime: string;
}

export interface BookingFilters {
  page?: number;
  pageSize?: number;
  status?: BookingStatus;
  from?: string;
  to?: string;
  userId?: string;
  zoneId?: string;
  userSearch?: string;
  zoneName?: string;
}

export interface BookingResponse {
  booking: BookingDetail;
  parkingSpot?: {
    id: string;
    zoneId: string;
    spotCode: string;
    status: ParkingSpotStatus;
    level: string | null;
    rowLabel: string | null;
  } | null;
}

export interface MyBookingsResponse {
  bookings: BookingSummary[];
}

export interface AdminBookingsResponse {
  bookings: BookingDetail[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export type BookingsApiClient = ReturnType<typeof createApiClient>;

export function createBookingsApi(apiClient: BookingsApiClient = createApiClient()) {
  return {
    createBooking(input: CreateBookingRequest): Promise<BookingResponse> {
      return apiClient.request<BookingResponse>("/api/bookings", {
        method: "POST",
        body: input,
        authenticated: true,
      });
    },

    listMyBookings(): Promise<MyBookingsResponse> {
      return apiClient.request<MyBookingsResponse>("/api/bookings/me", {
        authenticated: true,
      });
    },

    getBooking(id: string): Promise<BookingResponse> {
      return apiClient.request<BookingResponse>(`/api/bookings/${id}`, {
        authenticated: true,
      });
    },

    cancelBooking(id: string): Promise<BookingResponse> {
      return apiClient.request<BookingResponse>(`/api/bookings/${id}/cancel`, {
        method: "POST",
        authenticated: true,
      });
    },

    listAdminBookings(filters: BookingFilters = {}): Promise<AdminBookingsResponse> {
      return apiClient.request<AdminBookingsResponse>(buildAdminBookingsPath(filters), {
        authenticated: true,
      });
    },

    getAdminBooking(id: string): Promise<BookingResponse> {
      return apiClient.request<BookingResponse>(`/api/admin/bookings/${id}`, {
        authenticated: true,
      });
    },
  };
}

function buildAdminBookingsPath(filters: BookingFilters): string {
  const searchParams = new URLSearchParams();

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  if (filters.page) {
    searchParams.set("page", String(filters.page));
  }

  if (filters.pageSize) {
    searchParams.set("pageSize", String(filters.pageSize));
  }

  if (filters.from) {
    searchParams.set("from", filters.from);
  }

  if (filters.to) {
    searchParams.set("to", filters.to);
  }

  if (filters.userId) {
    searchParams.set("userId", filters.userId);
  }

  if (filters.zoneId) {
    searchParams.set("zoneId", filters.zoneId);
  }

  if (filters.userSearch) {
    searchParams.set("userSearch", filters.userSearch);
  }

  if (filters.zoneName) {
    searchParams.set("zoneName", filters.zoneName);
  }

  const query = searchParams.toString();

  return `/api/admin/bookings${query ? `?${query}` : ""}`;
}
