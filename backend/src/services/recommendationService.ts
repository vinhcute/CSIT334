import { SpotStatus } from "@prisma/client";
import type {
  RecommendationResponse,
  ZoneRecommendation,
} from "../domain/phase05.js";
import {
  RecommendationRepository,
  type RecommendationZoneWithSpots,
} from "../repositories/recommendationRepository.js";

export interface RecommendationReader {
  listZonesWithSpots(): Promise<RecommendationZoneWithSpots[]>;
}

interface ZoneStatusCounts {
  availableSpots: number;
  occupiedSpots: number;
  reservedSpots: number;
  maintenanceRequiredSpots: number;
}

export class RecommendationService {
  constructor(
    private readonly recommendationRepository: RecommendationReader = new RecommendationRepository(),
  ) {}

  async getNearestAvailableZone(): Promise<ZoneRecommendation | null> {
    const recommendations = await this.buildEligibleRecommendations();

    return (
      sortRecommendations(
        recommendations.map((recommendation) =>
          setRecommendationType(recommendation, "nearestAvailableZone"),
        ),
        compareNearestAvailable,
      )[0] ?? null
    );
  }

  async getLeastCongestedZone(): Promise<ZoneRecommendation | null> {
    const recommendations = await this.buildEligibleRecommendations();

    return sortRecommendations(recommendations, compareLeastCongested)[0] ?? null;
  }

  async getZoneRecommendations(now = new Date()): Promise<RecommendationResponse> {
    const recommendations = await this.buildEligibleRecommendations();
    const nearestAvailableZone =
      sortRecommendations(
        recommendations.map((recommendation) =>
          setRecommendationType(recommendation, "nearestAvailableZone"),
        ),
        compareNearestAvailable,
      )[0] ?? null;
    const leastCongestedZone =
      sortRecommendations(recommendations, compareLeastCongested)[0] ?? null;
    const orderedRecommendations = sortRecommendations(recommendations, compareLeastCongested);

    return {
      nearestAvailableZone,
      leastCongestedZone,
      recommendations: orderedRecommendations,
      generatedAt: now,
    };
  }

  private async buildEligibleRecommendations(): Promise<ZoneRecommendation[]> {
    const zones = await this.recommendationRepository.listZonesWithSpots();

    return zones
      .map((zone) => this.toRecommendation(zone))
      .filter((recommendation) => recommendation.availableSpots > 0);
  }

  private toRecommendation(zone: RecommendationZoneWithSpots): ZoneRecommendation {
    const counts = countSpotStatuses(zone);
    const occupancyRate = calculateOccupancyRate(zone.capacity, counts);

    return {
      type: "leastCongestedZone",
      zoneId: zone.id,
      zoneName: zone.name,
      distanceFromEntryMeters: zone.distanceFromEntryMeters,
      displayOrder: zone.displayOrder,
      capacity: zone.capacity,
      availableSpots: counts.availableSpots,
      occupiedSpots: counts.occupiedSpots,
      reservedSpots: counts.reservedSpots,
      maintenanceRequiredSpots: counts.maintenanceRequiredSpots,
      occupancyRate,
      reason: buildRecommendationReason(zone, counts, occupancyRate),
    };
  }
}

function countSpotStatuses(zone: RecommendationZoneWithSpots): ZoneStatusCounts {
  return zone.parkingSpots.reduce<ZoneStatusCounts>(
    (counts, spot) => {
      if (spot.status === SpotStatus.available) {
        counts.availableSpots += 1;
      }

      if (spot.status === SpotStatus.occupied) {
        counts.occupiedSpots += 1;
      }

      if (spot.status === SpotStatus.reserved) {
        counts.reservedSpots += 1;
      }

      if (spot.status === SpotStatus.maintenanceRequired) {
        counts.maintenanceRequiredSpots += 1;
      }

      return counts;
    },
    {
      availableSpots: 0,
      occupiedSpots: 0,
      reservedSpots: 0,
      maintenanceRequiredSpots: 0,
    },
  );
}

function calculateOccupancyRate(capacity: number, counts: ZoneStatusCounts): number {
  if (capacity <= 0) {
    return 0;
  }

  return roundRate(((counts.occupiedSpots + counts.reservedSpots) / capacity) * 100);
}

function buildRecommendationReason(
  zone: RecommendationZoneWithSpots,
  counts: ZoneStatusCounts,
  occupancyRate: number,
): string {
  const distanceText =
    zone.distanceFromEntryMeters === null
      ? "distance unavailable"
      : `${zone.distanceFromEntryMeters}m from entry`;

  return `${counts.availableSpots} available spots, ${occupancyRate.toFixed(2)}% occupied, ${distanceText}.`;
}

function compareNearestAvailable(left: ZoneRecommendation, right: ZoneRecommendation): number {
  return (
    compareDistanceKnownFirst(left.distanceFromEntryMeters, right.distanceFromEntryMeters) ||
    left.displayOrder - right.displayOrder ||
    left.zoneName.localeCompare(right.zoneName)
  );
}

function compareLeastCongested(left: ZoneRecommendation, right: ZoneRecommendation): number {
  return (
    left.occupancyRate - right.occupancyRate ||
    right.availableSpots - left.availableSpots ||
    compareDistanceKnownFirst(left.distanceFromEntryMeters, right.distanceFromEntryMeters) ||
    left.displayOrder - right.displayOrder ||
    left.zoneName.localeCompare(right.zoneName)
  );
}

function compareDistanceKnownFirst(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function roundRate(value: number): number {
  return Number(value.toFixed(2));
}

function sortRecommendations(
  recommendations: ZoneRecommendation[],
  compare: (left: ZoneRecommendation, right: ZoneRecommendation) => number,
): ZoneRecommendation[] {
  return [...recommendations].sort(compare);
}

function setRecommendationType(
  recommendation: ZoneRecommendation,
  type: ZoneRecommendation["type"],
): ZoneRecommendation {
  return {
    ...recommendation,
    type,
  };
}
