import { createApiClient } from "./apiClient.js";

export type PredictionConfidenceLabel = "low" | "medium" | "high";

export interface PredictiveAvailabilityResult {
  zoneId: string;
  zoneName: string;
  targetTime: string;
  capacity: number;
  predictedAvailableSpots: number;
  predictedOccupancyRate: number;
  availabilityProbability: number;
  confidenceLabel: PredictionConfidenceLabel;
  historicalSampleCount: number;
  basis: string;
}

export interface PredictiveAvailabilityResponse {
  prediction: PredictiveAvailabilityResult;
}

export interface PredictiveAvailabilityRequest {
  zoneId: string;
  targetTime: string;
}

export type PredictiveAvailabilityApiClient = ReturnType<typeof createApiClient>;

export function createPredictiveAvailabilityApi(
  apiClient: PredictiveAvailabilityApiClient = createApiClient(),
) {
  return {
    predictAvailability(
      input: PredictiveAvailabilityRequest,
    ): Promise<PredictiveAvailabilityResponse> {
      const params = new URLSearchParams({
        zoneId: input.zoneId,
        targetTime: input.targetTime,
      });

      return apiClient.request<PredictiveAvailabilityResponse>(
        `/api/predictive-availability?${params.toString()}`,
        { authenticated: true },
      );
    },
  };
}
