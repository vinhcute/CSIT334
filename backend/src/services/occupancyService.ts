import { SpotStatus } from "@prisma/client";
import {
  OccupancyRepository,
  type OccupancyZoneWithSpots,
} from "../repositories/occupancyRepository.js";

const statusTextByStatus: Record<SpotStatus, string> = {
  [SpotStatus.available]: "Available",
  [SpotStatus.occupied]: "Occupied",
  [SpotStatus.reserved]: "Reserved",
  [SpotStatus.maintenanceRequired]: "Maintenance required",
};

export class OccupancyZoneNotFoundError extends Error {
  constructor() {
    super("Parking zone not found.");
    this.name = "OccupancyZoneNotFoundError";
  }
}

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

export class OccupancyService {
  constructor(private readonly occupancyRepository = new OccupancyRepository()) {}

  async getSummary() {
    const zones = await this.occupancyRepository.listZonesWithSpots();
    const zoneSummaries = zones.map((zone) => this.calculateZoneSummary(zone));

    return {
      totalCapacity: zoneSummaries.reduce((sum, zone) => sum + zone.capacity, 0),
      totalAvailableSpots: zoneSummaries.reduce(
        (sum, zone) => sum + zone.availableSpots,
        0,
      ),
      totalOccupiedSpots: zoneSummaries.reduce(
        (sum, zone) => sum + zone.occupiedSpots,
        0,
      ),
      totalReservedSpots: zoneSummaries.reduce(
        (sum, zone) => sum + zone.reservedSpots,
        0,
      ),
      zones: zoneSummaries,
    };
  }

  async getZoneDetail(zoneId: string) {
    const zone = await this.occupancyRepository.findZoneWithSpots(zoneId);

    if (!zone) {
      throw new OccupancyZoneNotFoundError();
    }

    return {
      ...this.calculateZoneSummary(zone),
      spots: zone.parkingSpots.map((spot) => ({
        id: spot.id,
        zoneId: spot.zoneId,
        spotCode: spot.spotCode,
        status: spot.status,
        statusText: statusTextByStatus[spot.status],
        level: spot.level,
        rowLabel: spot.rowLabel,
      })),
    };
  }

  async recordZoneHistory(zoneId: string, recordedAt = new Date()) {
    const zone = await this.occupancyRepository.findZoneWithSpots(zoneId);

    if (!zone) {
      throw new OccupancyZoneNotFoundError();
    }

    const summary = this.calculateZoneSummary(zone);

    return this.occupancyRepository.createHistory({
      zoneId,
      recordedAt,
      capacity: summary.capacity,
      availableSpots: summary.availableSpots,
      occupiedSpots: summary.occupiedSpots,
      reservedSpots: summary.reservedSpots,
      occupancyRate: summary.occupancyRate,
    });
  }

  private calculateZoneSummary(zone: OccupancyZoneWithSpots): ZoneOccupancySummary {
    const availableSpots = zone.parkingSpots.filter(
      (spot) => spot.status === SpotStatus.available,
    ).length;
    const occupiedSpots = zone.parkingSpots.filter(
      (spot) => spot.status === SpotStatus.occupied,
    ).length;
    const reservedSpots = zone.parkingSpots.filter(
      (spot) => spot.status === SpotStatus.reserved,
    ).length;
    const maintenanceRequiredSpots = zone.parkingSpots.filter(
      (spot) => spot.status === SpotStatus.maintenanceRequired,
    ).length;
    const occupancyRate =
      zone.capacity === 0
        ? "0.00"
        : (((occupiedSpots + reservedSpots) / zone.capacity) * 100).toFixed(2);

    return {
      zoneId: zone.id,
      name: zone.name,
      description: zone.description,
      capacity: zone.capacity,
      distanceFromEntryMeters: zone.distanceFromEntryMeters,
      displayOrder: zone.displayOrder,
      availableSpots,
      occupiedSpots,
      reservedSpots,
      maintenanceRequiredSpots,
      occupancyRate,
    };
  }
}
