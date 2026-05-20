import { SpotStatus } from "@prisma/client";
import type {
  AnalyticsRange,
  AnalyticsSummary,
  OccupancyTrendPoint,
  PeakHourSummary,
  ZoneUtilisationSummary,
} from "../domain/phase05.js";
import {
  AnalyticsRepository,
  type AnalyticsHistoryRecord,
  type AnalyticsZoneWithSpots,
} from "../repositories/analyticsRepository.js";

export interface AnalyticsReader {
  listOccupancyHistorySince(start: Date): Promise<AnalyticsHistoryRecord[]>;
  listZonesWithSpots(): Promise<AnalyticsZoneWithSpots[]>;
}

export class AnalyticsValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Analytics request is invalid.");
    this.name = "AnalyticsValidationError";
  }
}

export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsReader = new AnalyticsRepository()) {}

  async getOccupancyTrends(
    range: AnalyticsRange = "today",
    now = new Date(),
  ): Promise<OccupancyTrendPoint[]> {
    const validRange = validateRange(range);
    const history = await this.analyticsRepository.listOccupancyHistorySince(
      getRangeStart(validRange, now),
    );

    return history.map(toTrendPoint);
  }

  async getPeakHours(
    range: AnalyticsRange = "today",
    now = new Date(),
  ): Promise<PeakHourSummary[]> {
    const validRange = validateRange(range);
    const history = await this.analyticsRepository.listOccupancyHistorySince(
      getRangeStart(validRange, now),
    );
    const groupedByHour = new Map<number, number[]>();

    for (const record of history) {
      const hour = record.recordedAt.getHours();
      const rates = groupedByHour.get(hour) ?? [];

      rates.push(toNumber(record.occupancyRate));
      groupedByHour.set(hour, rates);
    }

    return Array.from(groupedByHour.entries())
      .map(([hour, rates]) => ({
        hour,
        hourLabel: formatHourLabel(hour),
        averageOccupancyRate: roundRate(average(rates)),
        sampleCount: rates.length,
      }))
      .sort(
        (first, second) =>
          second.averageOccupancyRate - first.averageOccupancyRate ||
          second.sampleCount - first.sampleCount ||
          first.hour - second.hour,
      );
  }

  async getZoneUtilisation(): Promise<ZoneUtilisationSummary[]> {
    const zones = await this.analyticsRepository.listZonesWithSpots();

    return zones.map(toZoneUtilisation);
  }

  async getSummary(
    range: AnalyticsRange = "today",
    now = new Date(),
  ): Promise<AnalyticsSummary> {
    const validRange = validateRange(range);
    const [occupancyTrends, peakHours, zoneUtilisation] = await Promise.all([
      this.getOccupancyTrends(validRange, now),
      this.getPeakHours(validRange, now),
      this.getZoneUtilisation(),
    ]);
    const totals = zoneUtilisation.reduce(
      (summary, zone) => {
        summary.totalCapacity += zone.capacity;
        summary.totalAvailableSpots += zone.availableSpots;
        summary.totalOccupiedSpots += zone.occupiedSpots;
        summary.totalReservedSpots += zone.reservedSpots;
        summary.totalMaintenanceRequiredSpots += zone.maintenanceRequiredSpots;
        return summary;
      },
      {
        totalCapacity: 0,
        totalAvailableSpots: 0,
        totalOccupiedSpots: 0,
        totalReservedSpots: 0,
        totalMaintenanceRequiredSpots: 0,
      },
    );

    return {
      range: validRange,
      generatedAt: now,
      ...totals,
      averageOccupancyRate: calculateOccupancyRate(
        totals.totalOccupiedSpots + totals.totalReservedSpots,
        totals.totalCapacity,
      ),
      openIncidentCount: null,
      occupancyTrends,
      peakHours,
      zoneUtilisation,
    };
  }
}

function validateRange(range: AnalyticsRange): AnalyticsRange {
  if (range === "today" || range === "week" || range === "month") {
    return range;
  }

  throw new AnalyticsValidationError(["Range must be one of: today, week, month."]);
}

function getRangeStart(range: AnalyticsRange, now: Date): Date {
  if (range === "today") {
    const start = new Date(now);

    start.setHours(0, 0, 0, 0);
    return start;
  }

  const days = range === "week" ? 7 : 30;

  return new Date(now.getTime() - days * 24 * 60 * 60_000);
}

function toTrendPoint(record: AnalyticsHistoryRecord): OccupancyTrendPoint {
  return {
    recordedAt: record.recordedAt,
    zoneId: record.zoneId,
    zoneName: record.zone.name,
    capacity: record.capacity,
    availableSpots: record.availableSpots,
    occupiedSpots: record.occupiedSpots,
    reservedSpots: record.reservedSpots,
    occupancyRate: toNumber(record.occupancyRate),
  };
}

function toZoneUtilisation(zone: AnalyticsZoneWithSpots): ZoneUtilisationSummary {
  const counts = zone.parkingSpots.reduce(
    (totals, spot) => {
      if (spot.status === SpotStatus.available) {
        totals.availableSpots += 1;
      }

      if (spot.status === SpotStatus.occupied) {
        totals.occupiedSpots += 1;
      }

      if (spot.status === SpotStatus.reserved) {
        totals.reservedSpots += 1;
      }

      if (spot.status === SpotStatus.maintenanceRequired) {
        totals.maintenanceRequiredSpots += 1;
      }

      return totals;
    },
    {
      availableSpots: 0,
      occupiedSpots: 0,
      reservedSpots: 0,
      maintenanceRequiredSpots: 0,
    },
  );

  return {
    zoneId: zone.id,
    zoneName: zone.name,
    capacity: zone.capacity,
    ...counts,
    utilisationRate: calculateOccupancyRate(
      counts.occupiedSpots + counts.reservedSpots,
      zone.capacity,
    ),
  };
}

function formatHourLabel(hour: number): string {
  if (hour === 0) {
    return "12 AM";
  }

  if (hour < 12) {
    return `${hour} AM`;
  }

  if (hour === 12) {
    return "12 PM";
  }

  return `${hour - 12} PM`;
}

function calculateOccupancyRate(unavailableSpots: number, capacity: number): number {
  if (capacity <= 0) {
    return 0;
  }

  return roundRate((unavailableSpots / capacity) * 100);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundRate(value: number): number {
  return Number(value.toFixed(2));
}

function toNumber(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value.toString());
}
