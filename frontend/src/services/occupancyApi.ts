import { createApiClient } from "./apiClient.js";
import type { ParkingSpotStatus } from "./parkingSpotsApi.js";

export interface ZoneOccupancySummary {
  zoneId: string;
  name: string;
  description: string | null;
  capacity: number;
  distanceFromEntryMeters: number | null;
  displayOrder: number;
  availableSpots: number;
  occupiedSpots: number;
  reservedSpots: number;
  maintenanceRequiredSpots: number;
  occupancyRate: string;
}

export interface OccupancySummary {
  totalCapacity: number;
  totalAvailableSpots: number;
  totalOccupiedSpots: number;
  totalReservedSpots: number;
  zones: ZoneOccupancySummary[];
}

export interface OccupancySummaryResponse {
  summary: OccupancySummary;
}

export interface OccupancySpot {
  id: string;
  zoneId: string;
  spotCode: string;
  status: ParkingSpotStatus;
  statusText: string;
  level: string | null;
  rowLabel: string | null;
}

export interface ZoneOccupancyDetail extends ZoneOccupancySummary {
  spots: OccupancySpot[];
}

export interface ZoneOccupancyResponse {
  zone: ZoneOccupancyDetail;
}

export type OccupancyApiClient = ReturnType<typeof createApiClient>;

export function createOccupancyApi(apiClient: OccupancyApiClient = createApiClient()) {
  return {
    getSummary(): Promise<OccupancySummaryResponse> {
      return apiClient.request<OccupancySummaryResponse>("/api/occupancy/summary", {
        authenticated: true,
      });
    },

    getZoneDetail(zoneId: string): Promise<ZoneOccupancyResponse> {
      return apiClient.request<ZoneOccupancyResponse>(
        `/api/occupancy/zones/${zoneId}`,
        {
          authenticated: true,
        },
      );
    },
  };
}
