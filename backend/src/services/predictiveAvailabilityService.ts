import { SpotStatus } from "@prisma/client";
import type {
  PredictiveAvailabilityResult,
  PredictionConfidenceLabel,
} from "../domain/phase05.js";
import {
  PredictionRepository,
  type PredictionOccupancyHistoryRecord,
  type PredictionZoneWithSpots,
} from "../repositories/predictionRepository.js";

const minimumHistoricalSamples = 3;

export interface PredictiveAvailabilityInput {
  zoneId: string;
  targetTime: Date;
}

export interface PredictionReader {
  findZoneWithCurrentSpots(zoneId: string): Promise<PredictionZoneWithSpots | null>;
  listRecentHistory(zoneId: string, limit?: number): Promise<PredictionOccupancyHistoryRecord[]>;
}

export class PredictiveAvailabilityValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Predictive availability input is invalid.");
    this.name = "PredictiveAvailabilityValidationError";
  }
}

export class PredictiveAvailabilityZoneNotFoundError extends Error {
  constructor() {
    super("Parking zone not found.");
    this.name = "PredictiveAvailabilityZoneNotFoundError";
  }
}

export class PredictiveAvailabilityService {
  constructor(private readonly predictionRepository: PredictionReader = new PredictionRepository()) {}

  async predictAvailability(
    input: PredictiveAvailabilityInput,
    now = new Date(),
  ): Promise<PredictiveAvailabilityResult> {
    const issues = validatePredictionInput(input, now);

    if (issues.length > 0) {
      throw new PredictiveAvailabilityValidationError(issues);
    }

    const zone = await this.predictionRepository.findZoneWithCurrentSpots(input.zoneId);

    if (!zone) {
      throw new PredictiveAvailabilityZoneNotFoundError();
    }

    const history = await this.predictionRepository.listRecentHistory(input.zoneId);
    const matchingHistory = selectMatchingHistory(history, input.targetTime);

    if (matchingHistory.length >= minimumHistoricalSamples) {
      return this.buildHistoricalPrediction(zone, input.targetTime, matchingHistory);
    }

    return this.buildCurrentFallbackPrediction(zone, input.targetTime, matchingHistory.length);
  }

  private buildHistoricalPrediction(
    zone: PredictionZoneWithSpots,
    targetTime: Date,
    samples: PredictionOccupancyHistoryRecord[],
  ): PredictiveAvailabilityResult {
    const predictedAvailableSpots = clampSpotCount(
      Math.round(average(samples.map((sample) => sample.availableSpots))),
      zone.capacity,
    );
    const predictedOccupancyRate = clampRate(
      average(samples.map((sample) => Number(sample.occupancyRate.toString()))),
    );

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      targetTime,
      capacity: zone.capacity,
      predictedAvailableSpots,
      predictedOccupancyRate,
      availabilityProbability: calculateAvailabilityProbability(
        predictedAvailableSpots,
        zone.capacity,
      ),
      confidenceLabel: getHistoricalConfidence(samples.length),
      historicalSampleCount: samples.length,
      basis: `Based on ${samples.length} historical samples from the same weekday and hour.`,
    };
  }

  private buildCurrentFallbackPrediction(
    zone: PredictionZoneWithSpots,
    targetTime: Date,
    historicalSampleCount: number,
  ): PredictiveAvailabilityResult {
    const currentCounts = countCurrentSpotStatuses(zone);
    const predictedAvailableSpots = clampSpotCount(currentCounts.availableSpots, zone.capacity);
    const predictedOccupancyRate = calculateOccupancyRate(
      currentCounts.occupiedSpots + currentCounts.reservedSpots,
      zone.capacity,
    );

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      targetTime,
      capacity: zone.capacity,
      predictedAvailableSpots,
      predictedOccupancyRate,
      availabilityProbability: calculateAvailabilityProbability(
        predictedAvailableSpots,
        zone.capacity,
      ),
      confidenceLabel: "low",
      historicalSampleCount,
      basis:
        historicalSampleCount === 0
          ? "No matching historical samples were available, so current spot status was used."
          : `Only ${historicalSampleCount} matching historical samples were available, so current spot status was used.`,
    };
  }
}

function validatePredictionInput(input: PredictiveAvailabilityInput, now: Date): string[] {
  const issues: string[] = [];

  if (!input.zoneId?.trim()) {
    issues.push("Parking zone ID is required.");
  }

  if (!(input.targetTime instanceof Date) || Number.isNaN(input.targetTime.getTime())) {
    issues.push("Target time must be a valid date.");
  } else if (input.targetTime.getTime() <= now.getTime()) {
    issues.push("Target time must be in the future.");
  }

  return issues;
}

function selectMatchingHistory(
  history: PredictionOccupancyHistoryRecord[],
  targetTime: Date,
): PredictionOccupancyHistoryRecord[] {
  const targetDay = targetTime.getUTCDay();
  const targetHour = targetTime.getUTCHours();

  return history.filter(
    (sample) =>
      sample.recordedAt.getUTCDay() === targetDay &&
      sample.recordedAt.getUTCHours() === targetHour,
  );
}

function countCurrentSpotStatuses(zone: PredictionZoneWithSpots) {
  return zone.parkingSpots.reduce(
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

      return counts;
    },
    {
      availableSpots: 0,
      occupiedSpots: 0,
      reservedSpots: 0,
    },
  );
}

function getHistoricalConfidence(sampleCount: number): PredictionConfidenceLabel {
  if (sampleCount >= 8) {
    return "high";
  }

  if (sampleCount >= minimumHistoricalSamples) {
    return "medium";
  }

  return "low";
}

function calculateOccupancyRate(unavailableSpots: number, capacity: number): number {
  if (capacity <= 0) {
    return 0;
  }

  return clampRate((unavailableSpots / capacity) * 100);
}

function calculateAvailabilityProbability(availableSpots: number, capacity: number): number {
  if (capacity <= 0) {
    return 0;
  }

  return clampRate((availableSpots / capacity) * 100);
}

function clampSpotCount(value: number, capacity: number): number {
  return Math.min(Math.max(value, 0), Math.max(capacity, 0));
}

function clampRate(value: number): number {
  return Number(Math.min(Math.max(value, 0), 100).toFixed(2));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
