import { createApiClient } from "./apiClient.js";
import type { ParkingSpot } from "./parkingSpotsApi.js";

export type DetectionEventType = "vehicleEntry" | "vehicleExit";

export interface DetectionEvent {
  id: string;
  spotId: string;
  type: DetectionEventType;
  occurredAt: string;
  rawPayload: unknown;
  createdAt: string;
}

export interface DetectionEventsResponse {
  detectionEvents: DetectionEvent[];
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
    listRecentDetectionEvents(): Promise<DetectionEventsResponse> {
      return apiClient.request<DetectionEventsResponse>("/api/admin/detection-events", {
        authenticated: true,
      });
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
