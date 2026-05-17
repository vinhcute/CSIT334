import { SpotStatus } from "@prisma/client";
import {
  AnalyticsRepository,
  type AnalyticsOccupancyHistoryRecord,
  type AnalyticsZone,
} from "../repositories/analyticsRepository.js";

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

const rangeHours: Record<AnalyticsRange, number> = {
  today: 24,
  week: 24 * 7,
  month: 24 * 30,
};

export class AnalyticsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyticsValidationError";
  }
}

export class AnalyticsService {
  constructor(private readonly analyticsRepository = new AnalyticsRepository()) {}

  async getCampusAnalytics(rangeInput: unknown = "today"): Promise<CampusAnalytics> {
    const range = parseAnalyticsRange(rangeInput);
    const [latestTimestamp, zones] = await Promise.all([
      this.analyticsRepository.findLatestOccupancyTimestamp(),
      this.analyticsRepository.listZonesWithSpotStatuses(),
    ]);
    const occupancyHistory = latestTimestamp
      ? await this.analyticsRepository.listOccupancyHistorySince(
          subtractHours(latestTimestamp, rangeHours[range] - 1),
        )
      : [];

    return {
      range,
      occupancyTrend: buildOccupancyTrend(occupancyHistory),
      zoneUtilisation: zones.map(calculateZoneUtilisation),
    };
  }
}

function parseAnalyticsRange(value: unknown): AnalyticsRange {
  if (value === undefined || value === "today") {
    return "today";
  }

  if (value === "week" || value === "month") {
    return value;
  }

  throw new AnalyticsValidationError("Analytics range is invalid.");
}

function subtractHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

function buildOccupancyTrend(
  records: AnalyticsOccupancyHistoryRecord[],
): OccupancyTrendPoint[] {
  const groupedRecords = new Map<
    string,
    { recordedAt: Date; rates: number[]; availableSpots: number }
  >();

  for (const record of records) {
    const key = record.recordedAt.toISOString();
    const group =
      groupedRecords.get(key) ??
      {
        recordedAt: record.recordedAt,
        rates: [],
        availableSpots: 0,
      };

    group.rates.push(Number(record.occupancyRate));
    group.availableSpots += record.availableSpots;
    groupedRecords.set(key, group);
  }

  return Array.from(groupedRecords.values())
    .sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime())
    .slice(-8)
    .map((group) => ({
      label: formatTrendLabel(group.recordedAt),
      occupancyRate: Math.round(
        group.rates.reduce((sum, rate) => sum + rate, 0) / group.rates.length,
      ),
      availableSpots: group.availableSpots,
    }));
}

function calculateZoneUtilisation(zone: AnalyticsZone): ZoneUtilisationSummary {
  const availableSpots = zone.parkingSpots.filter(
    (spot) => spot.status === SpotStatus.available,
  ).length;
  const occupiedSpots = zone.parkingSpots.filter(
    (spot) => spot.status === SpotStatus.occupied,
  ).length;
  const reservedSpots = zone.parkingSpots.filter(
    (spot) => spot.status === SpotStatus.reserved,
  ).length;
  const utilisationRate =
    zone.capacity === 0
      ? 0
      : Math.round(((occupiedSpots + reservedSpots) / zone.capacity) * 100);

  return {
    zoneName: zone.name,
    utilisationRate,
    availableSpots,
    occupiedSpots,
    reservedSpots,
  };
}

function formatTrendLabel(date: Date): string {
  const hour = String(date.getUTCHours()).padStart(2, "0");

  return `${hour}:00`;
}
