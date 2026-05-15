import { createApiClient } from "./apiClient.js";

export type ParkingSpotStatus =
  | "available"
  | "occupied"
  | "reserved"
  | "maintenanceRequired";

export interface ParkingSpot {
  id: string;
  zoneId: string;
  spotCode: string;
  status: ParkingSpotStatus;
  level: string | null;
  rowLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParkingSpotsResponse {
  parkingSpots: ParkingSpot[];
}

export interface ParkingSpotResponse {
  parkingSpot: ParkingSpot;
}

export interface ParkingSpotFilters {
  zoneId?: string;
  status?: ParkingSpotStatus;
}

export interface ParkingSpotRequest {
  zoneId?: string;
  spotCode?: string;
  status?: ParkingSpotStatus;
  level?: string | null;
  rowLabel?: string | null;
}

export type ParkingSpotsApiClient = ReturnType<typeof createApiClient>;

export function createParkingSpotsApi(
  apiClient: ParkingSpotsApiClient = createApiClient(),
) {
  return {
    listSpots(filters: ParkingSpotFilters = {}): Promise<ParkingSpotsResponse> {
      return apiClient.request<ParkingSpotsResponse>(buildParkingSpotsPath(filters), {
        authenticated: true,
      });
    },

    listSpotsForZone(
      zoneId: string,
      filters: Pick<ParkingSpotFilters, "status"> = {},
    ): Promise<ParkingSpotsResponse> {
      const searchParams = new URLSearchParams();

      if (filters.status) {
        searchParams.set("status", filters.status);
      }

      const query = searchParams.toString();

      return apiClient.request<ParkingSpotsResponse>(
        `/api/parking-zones/${zoneId}/parking-spots${query ? `?${query}` : ""}`,
        {
          authenticated: true,
        },
      );
    },

    createSpot(input: ParkingSpotRequest): Promise<ParkingSpotResponse> {
      return apiClient.request<ParkingSpotResponse>("/api/admin/parking-spots", {
        method: "POST",
        body: input,
        authenticated: true,
      });
    },

    updateSpot(spotId: string, input: ParkingSpotRequest): Promise<ParkingSpotResponse> {
      return apiClient.request<ParkingSpotResponse>(
        `/api/admin/parking-spots/${spotId}`,
        {
          method: "PATCH",
          body: input,
          authenticated: true,
        },
      );
    },

    deleteSpot(spotId: string): Promise<ParkingSpotResponse> {
      return apiClient.request<ParkingSpotResponse>(
        `/api/admin/parking-spots/${spotId}`,
        {
          method: "DELETE",
          authenticated: true,
        },
      );
    },
  };
}

function buildParkingSpotsPath(filters: ParkingSpotFilters): string {
  const searchParams = new URLSearchParams();

  if (filters.zoneId) {
    searchParams.set("zoneId", filters.zoneId);
  }

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  const query = searchParams.toString();

  return `/api/parking-spots${query ? `?${query}` : ""}`;
}
