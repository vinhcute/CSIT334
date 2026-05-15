import { createApiClient } from "./apiClient.js";

export interface ParkingZone {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  distanceFromEntryMeters: number | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ParkingZonesResponse {
  parkingZones: ParkingZone[];
}

export interface ParkingZoneResponse {
  parkingZone: ParkingZone;
}

export interface ParkingZoneRequest {
  name?: string;
  description?: string | null;
  capacity?: number;
  distanceFromEntryMeters?: number | null;
  displayOrder?: number;
}

export interface ParkingApiErrorBody {
  error: string;
  issues?: string[];
}

export type ParkingZonesApiClient = ReturnType<typeof createApiClient>;

export function createParkingZonesApi(
  apiClient: ParkingZonesApiClient = createApiClient(),
) {
  return {
    listZones(): Promise<ParkingZonesResponse> {
      return apiClient.request<ParkingZonesResponse>("/api/parking-zones", {
        authenticated: true,
      });
    },

    createZone(input: ParkingZoneRequest): Promise<ParkingZoneResponse> {
      return apiClient.request<ParkingZoneResponse>("/api/admin/parking-zones", {
        method: "POST",
        body: input,
        authenticated: true,
      });
    },

    updateZone(zoneId: string, input: ParkingZoneRequest): Promise<ParkingZoneResponse> {
      return apiClient.request<ParkingZoneResponse>(
        `/api/admin/parking-zones/${zoneId}`,
        {
          method: "PATCH",
          body: input,
          authenticated: true,
        },
      );
    },

    deleteZone(zoneId: string): Promise<ParkingZoneResponse> {
      return apiClient.request<ParkingZoneResponse>(
        `/api/admin/parking-zones/${zoneId}`,
        {
          method: "DELETE",
          authenticated: true,
        },
      );
    },
  };
}
