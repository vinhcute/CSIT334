import { createApiClient } from "./apiClient.js";

export type AnalyticsRange = "today" | "week" | "month";

export interface OccupancyTrendPoint {
  recordedAt: string;
  zoneId: string | null;
  zoneName: string | null;
  capacity: number;
  availableSpots: number;
  occupiedSpots: number;
  reservedSpots: number;
  occupancyRate: number;
}

export interface PeakHourSummary {
  hour: number;
  hourLabel: string;
  averageOccupancyRate: number;
  sampleCount: number;
}

export interface ZoneUtilisationSummary {
  zoneId: string;
  zoneName: string;
  capacity: number;
  availableSpots: number;
  occupiedSpots: number;
  reservedSpots: number;
  maintenanceRequiredSpots: number;
  utilisationRate: number;
}

export interface AnalyticsSummary {
  range: AnalyticsRange;
  generatedAt: string;
  totalCapacity: number;
  totalAvailableSpots: number;
  totalOccupiedSpots: number;
  totalReservedSpots: number;
  totalMaintenanceRequiredSpots: number;
  averageOccupancyRate: number;
  openIncidentCount: number | null;
  occupancyTrends: OccupancyTrendPoint[];
  peakHours: PeakHourSummary[];
  zoneUtilisation: ZoneUtilisationSummary[];
}

export interface OccupancyTrendsResponse {
  occupancyTrends: OccupancyTrendPoint[];
}

export interface PeakHoursResponse {
  peakHours: PeakHourSummary[];
}

export interface ZoneUtilisationResponse {
  zoneUtilisation: ZoneUtilisationSummary[];
}

export interface AnalyticsSummaryResponse {
  summary: AnalyticsSummary;
}

export type AnalyticsApiClient = ReturnType<typeof createApiClient>;

export function createAnalyticsApi(apiClient: AnalyticsApiClient = createApiClient()) {
  return {
    getOccupancyTrends(range: AnalyticsRange): Promise<OccupancyTrendsResponse> {
      return apiClient.request<OccupancyTrendsResponse>(
        buildAnalyticsPath("/api/admin/analytics/occupancy-trends", range),
        { authenticated: true },
      );
    },

    getPeakHours(range: AnalyticsRange): Promise<PeakHoursResponse> {
      return apiClient.request<PeakHoursResponse>(
        buildAnalyticsPath("/api/admin/analytics/peak-hours", range),
        { authenticated: true },
      );
    },

    getZoneUtilisation(): Promise<ZoneUtilisationResponse> {
      return apiClient.request<ZoneUtilisationResponse>(
        "/api/admin/analytics/zone-utilisation",
        { authenticated: true },
      );
    },

    getSummary(range: AnalyticsRange): Promise<AnalyticsSummaryResponse> {
      return apiClient.request<AnalyticsSummaryResponse>(
        buildAnalyticsPath("/api/admin/analytics/summary", range),
        { authenticated: true },
      );
    },
  };
}

function buildAnalyticsPath(path: string, range: AnalyticsRange): string {
  const params = new URLSearchParams({ range });

  return `${path}?${params.toString()}`;
}
