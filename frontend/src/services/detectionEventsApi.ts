import { createApiClient } from "./apiClient.js";
import type { ParkingSpot } from "./parkingSpotsApi.js";

export type DetectionEventType = "vehicleEntry" | "vehicleExit";

export interface DetectionEvent {
  id: string;
  spotId: string;
  spot: {
    id: string;
    zoneId: string;
    spotCode: string;
  } | null;
  type: DetectionEventType;
  occurredAt: string;
  rawPayload: unknown;
  createdAt: string;
}

export interface DetectionEventsResponse {
  detectionEvents: DetectionEvent[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface DetectionEventsFilters {
  page?: number;
  pageSize?: number;
  spotId?: string;
  type?: DetectionEventType;
}

export interface IngestDetectionEventRequest {
  spotId: string;
  type: DetectionEventType;
  occurredAt?: string;
  rawPayload?: unknown;
}

export interface IngestDetectionEventResponse {
  detectionEvent: DetectionEvent;
  parkingSpot: ParkingSpot;
}

export type DetectionEventsApiClient = ReturnType<typeof createApiClient>;

export function createDetectionEventsApi(
  apiClient: DetectionEventsApiClient = createApiClient(),
) {
  return {
    listRecentDetectionEvents(
      filters: DetectionEventsFilters = {},
    ): Promise<DetectionEventsResponse> {
      return apiClient.request<DetectionEventsResponse>(
        buildDetectionEventsPath(filters),
        {
          authenticated: true,
        },
      );
    },

    ingestDetectionEvent(
      input: IngestDetectionEventRequest,
    ): Promise<IngestDetectionEventResponse> {
      return apiClient.request<IngestDetectionEventResponse>(
        "/api/admin/detection-events",
        {
          method: "POST",
          body: input,
          authenticated: true,
        },
      );
    },
  };
}

function buildDetectionEventsPath(filters: DetectionEventsFilters): string {
  const searchParams = new URLSearchParams();

  if (filters.page) {
    searchParams.set("page", String(filters.page));
  }

  if (filters.pageSize) {
    searchParams.set("pageSize", String(filters.pageSize));
  }

  if (filters.spotId) {
    searchParams.set("spotId", filters.spotId);
  }

  if (filters.type) {
    searchParams.set("type", filters.type);
  }

  const query = searchParams.toString();

  return `/api/admin/detection-events${query ? `?${query}` : ""}`;
}
