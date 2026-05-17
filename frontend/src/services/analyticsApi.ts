import { createApiClient } from "./apiClient.js";

export type AnalyticsRange = "today" | "week" | "month";

export interface OccupancyTrendPoint {
  label: string;
  occupancyRate: number;
  availableSpots: number;
}

export interface ZoneUtilisationSummary {
  zoneName: string;
  utilisationRate: number;
  availableSpots: number;
  occupiedSpots: number;
  reservedSpots: number;
}

export interface CampusAnalytics {
  range: AnalyticsRange;
  occupancyTrend: OccupancyTrendPoint[];
  zoneUtilisation: ZoneUtilisationSummary[];
}

export interface CampusAnalyticsResponse {
  analytics: CampusAnalytics;
}

export type AnalyticsApiClient = ReturnType<typeof createApiClient>;

export function createAnalyticsApi(apiClient: AnalyticsApiClient = createApiClient()) {
  return {
    getCampusAnalytics(range: AnalyticsRange): Promise<CampusAnalyticsResponse> {
      return apiClient.request<CampusAnalyticsResponse>(
        `/api/admin/analytics?range=${range}`,
        {
          authenticated: true,
        },
      );
    },
  };
}
