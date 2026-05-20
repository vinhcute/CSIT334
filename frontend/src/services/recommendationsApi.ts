import { createApiClient } from "./apiClient.js";

export type RecommendationKind = "nearestAvailableZone" | "leastCongestedZone";

export interface ZoneRecommendation {
  type: RecommendationKind;
  zoneId: string;
  zoneName: string;
  distanceFromEntryMeters: number | null;
  displayOrder: number;
  capacity: number;
  availableSpots: number;
  occupiedSpots: number;
  reservedSpots: number;
  maintenanceRequiredSpots: number;
  occupancyRate: number;
  reason: string;
}

export interface SingleRecommendationResponse {
  recommendation: ZoneRecommendation | null;
}

export interface RecommendationResponse {
  nearestAvailableZone: ZoneRecommendation | null;
  leastCongestedZone: ZoneRecommendation | null;
  recommendations: ZoneRecommendation[];
  generatedAt: string;
}

export interface RecommendationsResponse {
  recommendations: RecommendationResponse;
}

export type RecommendationsApiClient = ReturnType<typeof createApiClient>;

export function createRecommendationsApi(
  apiClient: RecommendationsApiClient = createApiClient(),
) {
  return {
    getNearestZone(): Promise<SingleRecommendationResponse> {
      return apiClient.request<SingleRecommendationResponse>(
        "/api/recommendations/nearest-zone",
        { authenticated: true },
      );
    },

    getLeastCongestedZone(): Promise<SingleRecommendationResponse> {
      return apiClient.request<SingleRecommendationResponse>(
        "/api/recommendations/least-congested-zone",
        { authenticated: true },
      );
    },

    getZoneRecommendations(): Promise<RecommendationsResponse> {
      return apiClient.request<RecommendationsResponse>("/api/recommendations/zones", {
        authenticated: true,
      });
    },
  };
}
