import type { IncidentStatus, SpotStatus } from "./enums.js";
import type { IncidentReportId, ParkingSpotId, ParkingZoneId, UserId } from "./types.js";

export type RecommendationKind = "nearestAvailableZone" | "leastCongestedZone";

export interface ZoneRecommendation {
  type: RecommendationKind;
  zoneId: ParkingZoneId;
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

export interface RecommendationResponse {
  nearestAvailableZone: ZoneRecommendation | null;
  leastCongestedZone: ZoneRecommendation | null;
  recommendations: ZoneRecommendation[];
  generatedAt: Date;
}

export type PredictionConfidenceLabel = "low" | "medium" | "high";

export interface PredictiveAvailabilityResult {
  zoneId: ParkingZoneId;
  zoneName: string;
  targetTime: Date;
  capacity: number;
  predictedAvailableSpots: number;
  predictedOccupancyRate: number;
  availabilityProbability: number;
  confidenceLabel: PredictionConfidenceLabel;
  historicalSampleCount: number;
  basis: string;
}

export interface OccupancyTrendPoint {
  recordedAt: Date;
  zoneId: ParkingZoneId | null;
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
  zoneId: ParkingZoneId;
  zoneName: string;
  capacity: number;
  availableSpots: number;
  occupiedSpots: number;
  reservedSpots: number;
  maintenanceRequiredSpots: number;
  utilisationRate: number;
}

export type AnalyticsRange = "today" | "week" | "month";

export interface AnalyticsSummary {
  range: AnalyticsRange;
  generatedAt: Date;
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

export type IncidentIssueType =
  | "spotDiscrepancy"
  | "sensorFault"
  | "paymentIssue"
  | "safetyConcern"
  | "other";

export interface IncidentSpotSummary {
  id: ParkingSpotId;
  spotCode: string;
  status: SpotStatus;
  zone: {
    id: ParkingZoneId;
    name: string;
  };
  level: string | null;
  rowLabel: string | null;
}

export interface IncidentReporterSummary {
  id: UserId;
  name: string;
  email: string;
}

export interface IncidentReportSummary {
  id: IncidentReportId;
  userId: UserId;
  status: IncidentStatus;
  issueType: IncidentIssueType;
  descriptionPreview: string;
  spot: IncidentSpotSummary | null;
  reporter: IncidentReporterSummary | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export interface IncidentReportDetail extends IncidentReportSummary {
  description: string;
  resolution: string | null;
}
