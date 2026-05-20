import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, ApiResponseFormatError, createApiClient } from "../../services/apiClient.js";
import {
  createOccupancyApi,
  type OccupancySummary,
  type ZoneOccupancySummary,
} from "../../services/occupancyApi.js";
import { createParkingEventsApi } from "../../services/parkingEventsApi.js";
import { createParkingZonesApi, type ParkingZone } from "../../services/parkingZonesApi.js";
import {
  createPredictiveAvailabilityApi,
  type PredictiveAvailabilityResult,
} from "../../services/predictiveAvailabilityApi.js";
import {
  createRecommendationsApi,
  type RecommendationResponse,
  type ZoneRecommendation,
} from "../../services/recommendationsApi.js";

const sharedApiClient = createApiClient();

type DashboardStatus = "loading" | "ready" | "empty" | "error";
type RecommendationStatus = "idle" | "loading" | "ready" | "empty" | "error" | "permission";
type PredictionStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "permission"
  | "validation";
type AvailabilityTone = "open" | "limited" | "full" | "empty";

export interface PredictionZoneOption {
  id: string;
  name: string;
}

export interface DashboardStat {
  label: string;
  value: string;
}

export function hasDashboardAvailability(summary: OccupancySummary | null): boolean {
  return Boolean(summary && summary.totalCapacity > 0 && summary.zones.length > 0);
}

export function getCampusOccupancyRate(summary: OccupancySummary): string {
  if (summary.totalCapacity <= 0) {
    return "0%";
  }

  const unavailableSpots =
    summary.totalCapacity - summary.totalAvailableSpots;
  const rate = Math.round((unavailableSpots * 100) / summary.totalCapacity);

  return `${rate}%`;
}

export function buildDashboardStats(summary: OccupancySummary): DashboardStat[] {
  return [
    { label: "Total Capacity", value: String(summary.totalCapacity) },
    { label: "Available Spots", value: String(summary.totalAvailableSpots) },
    { label: "Occupied", value: String(summary.totalOccupiedSpots) },
    { label: "Reserved", value: String(summary.totalReservedSpots) },
  ];
}

export function getZoneAvailablePercentage(zone: ZoneOccupancySummary): number {
  if (zone.capacity <= 0) {
    return 0;
  }

  return Math.round((zone.availableSpots / zone.capacity) * 100);
}

export function getZoneAvailabilityTone(zone: ZoneOccupancySummary): AvailabilityTone {
  const availablePercentage = getZoneAvailablePercentage(zone);

  if (zone.capacity <= 0) {
    return "empty";
  }

  if (availablePercentage >= 50) {
    return "open";
  }

  if (availablePercentage >= 20) {
    return "limited";
  }

  return "full";
}

export function getZoneAvailabilityLabel(zone: ZoneOccupancySummary): string {
  const labelByTone: Record<AvailabilityTone, string> = {
    open: "High availability",
    limited: "Limited availability",
    full: "Low availability",
    empty: "No capacity",
  };

  return labelByTone[getZoneAvailabilityTone(zone)];
}

export function getParkingDashboardErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { error?: string } | null;

    if (body?.error) {
      return body.error;
    }
  }

  if (error instanceof ApiResponseFormatError) {
    return "The occupancy API returned a non-JSON response. Rebuild and restart the backend server, then retry.";
  }

  return "Unable to load parking availability. Please check the API server and try again.";
}

export function getRecommendationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { error?: string } | null;

    if (error.status === 401 || error.status === 403) {
      return body?.error ?? "Smart suggestions are not available for this account.";
    }

    if (body?.error) {
      return body.error;
    }
  }

  if (error instanceof ApiResponseFormatError) {
    return "The recommendations API returned a non-JSON response. Rebuild and restart the backend server, then retry.";
  }

  return "Unable to load smart suggestions. Please try again.";
}

export function getPredictionErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { error?: string; issues?: string[] } | null;

    if (body?.issues?.length) {
      return body.issues.join(" ");
    }

    if (body?.error) {
      return body.error;
    }
  }

  if (error instanceof ApiResponseFormatError) {
    return "The predictive availability API returned a non-JSON response. Rebuild and restart the backend server, then retry.";
  }

  return "Unable to predict availability. Please try again.";
}

export function getRecommendationStatus(
  recommendations: RecommendationResponse | null,
): RecommendationStatus {
  if (!recommendations) {
    return "idle";
  }

  return recommendations.nearestAvailableZone || recommendations.leastCongestedZone
    ? "ready"
    : "empty";
}

export function formatRecommendationDistance(recommendation: ZoneRecommendation): string {
  return recommendation.distanceFromEntryMeters === null
    ? "Distance unavailable"
    : `${recommendation.distanceFromEntryMeters}m from entry`;
}

export function formatRecommendationAvailability(recommendation: ZoneRecommendation): string {
  return `${recommendation.availableSpots} of ${recommendation.capacity} spots available`;
}

export function buildPredictionZoneOptions(
  zones: ParkingZone[],
  fallbackZones: ZoneOccupancySummary[],
): PredictionZoneOption[] {
  const source =
    zones.length > 0
      ? zones.map((zone) => ({ id: zone.id, name: zone.name }))
      : fallbackZones.map((zone) => ({ id: zone.zoneId, name: zone.name }));

  return source.sort((first, second) => first.name.localeCompare(second.name));
}

export function toDateTimeLocalValue(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return offsetDate.toISOString().slice(0, 16);
}

export function createDefaultPredictionTargetTime(now = new Date()): string {
  return toDateTimeLocalValue(new Date(now.getTime() + 60 * 60_000));
}

export function getPredictionValidationError(
  zoneId: string,
  targetTimeValue: string,
  now = new Date(),
): string | null {
  if (!zoneId) {
    return "Choose a parking zone before requesting a prediction.";
  }

  if (!targetTimeValue) {
    return "Choose a future date and time.";
  }

  const targetTime = new Date(targetTimeValue);

  if (Number.isNaN(targetTime.getTime())) {
    return "Choose a valid date and time.";
  }

  if (targetTime.getTime() <= now.getTime()) {
    return "Prediction time must be in the future.";
  }

  return null;
}

export function formatPredictionTargetTime(targetTime: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(targetTime));
}

export function formatPredictionOccupancy(prediction: PredictiveAvailabilityResult): string {
  return `${prediction.predictedOccupancyRate.toFixed(2)}% occupied`;
}

export function formatPredictionConfidence(label: PredictiveAvailabilityResult["confidenceLabel"]) {
  const labels: Record<PredictiveAvailabilityResult["confidenceLabel"], string> = {
    low: "Low confidence",
    medium: "Medium confidence",
    high: "High confidence",
  };

  return labels[label];
}

export function ParkingDashboardPage() {
  const occupancyApi = useMemo(() => createOccupancyApi(sharedApiClient), []);
  const parkingEventsApi = useMemo(() => createParkingEventsApi(sharedApiClient), []);
  const parkingZonesApi = useMemo(() => createParkingZonesApi(sharedApiClient), []);
  const predictiveAvailabilityApi = useMemo(
    () => createPredictiveAvailabilityApi(sharedApiClient),
    [],
  );
  const recommendationsApi = useMemo(() => createRecommendationsApi(sharedApiClient), []);
  const [status, setStatus] = useState<DashboardStatus>("loading");
  const [summary, setSummary] = useState<OccupancySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendationStatus, setRecommendationStatus] =
    useState<RecommendationStatus>("idle");
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(
    null,
  );
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [predictionZones, setPredictionZones] = useState<ParkingZone[]>([]);
  const [predictionStatus, setPredictionStatus] = useState<PredictionStatus>("idle");
  const [prediction, setPrediction] = useState<PredictiveAvailabilityResult | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [selectedPredictionZoneId, setSelectedPredictionZoneId] = useState("");
  const [predictionTargetTime, setPredictionTargetTime] = useState(() =>
    createDefaultPredictionTargetTime(),
  );

  const loadAvailability = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const response = await occupancyApi.getSummary();

      setSummary(response.summary);
      setStatus(hasDashboardAvailability(response.summary) ? "ready" : "empty");
    } catch (loadError) {
      setStatus("error");
      setError(getParkingDashboardErrorMessage(loadError));
    }
  }, [occupancyApi]);

  const loadRecommendations = useCallback(async () => {
    setRecommendationStatus("loading");
    setRecommendationError(null);

    try {
      const response = await recommendationsApi.getZoneRecommendations();

      setRecommendations(response.recommendations);
      setRecommendationStatus(getRecommendationStatus(response.recommendations));
    } catch (loadError) {
      const isPermissionError =
        loadError instanceof ApiError && (loadError.status === 401 || loadError.status === 403);

      setRecommendations(null);
      setRecommendationStatus(isPermissionError ? "permission" : "error");
      setRecommendationError(getRecommendationErrorMessage(loadError));
    }
  }, [recommendationsApi]);

  const loadPredictionZones = useCallback(async () => {
    try {
      const response = await parkingZonesApi.listZones();

      setPredictionZones(response.parkingZones);
    } catch (loadError) {
      const isPermissionError =
        loadError instanceof ApiError && (loadError.status === 401 || loadError.status === 403);

      setPredictionStatus(isPermissionError ? "permission" : "error");
      setPredictionError(getPredictionErrorMessage(loadError));
    }
  }, [parkingZonesApi]);

  const predictionZoneOptions = useMemo(
    () => buildPredictionZoneOptions(predictionZones, summary?.zones ?? []),
    [predictionZones, summary],
  );

  const requestPrediction = useCallback(async () => {
    const validationError = getPredictionValidationError(
      selectedPredictionZoneId,
      predictionTargetTime,
    );

    if (validationError) {
      setPrediction(null);
      setPredictionStatus("validation");
      setPredictionError(validationError);
      return;
    }

    setPredictionStatus("loading");
    setPredictionError(null);

    try {
      const response = await predictiveAvailabilityApi.predictAvailability({
        zoneId: selectedPredictionZoneId,
        targetTime: new Date(predictionTargetTime).toISOString(),
      });

      setPrediction(response.prediction);
      setPredictionStatus("ready");
    } catch (loadError) {
      const isPermissionError =
        loadError instanceof ApiError && (loadError.status === 401 || loadError.status === 403);

      setPrediction(null);
      setPredictionStatus(isPermissionError ? "permission" : "error");
      setPredictionError(getPredictionErrorMessage(loadError));
    }
  }, [predictionTargetTime, predictiveAvailabilityApi, selectedPredictionZoneId]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  useEffect(() => {
    void loadPredictionZones();
  }, [loadPredictionZones]);

  useEffect(() => {
    if (!selectedPredictionZoneId && predictionZoneOptions.length > 0) {
      setSelectedPredictionZoneId(predictionZoneOptions[0].id);
    }
  }, [predictionZoneOptions, selectedPredictionZoneId]);

  useEffect(() => {
    let pollingInterval: number | undefined;
    const startFallbackPolling = () => {
      if (pollingInterval !== undefined) {
        return;
      }

      pollingInterval = window.setInterval(() => {
        void loadAvailability();
      }, 3000);
    };
    const unsubscribe = parkingEventsApi.subscribeToParkingUpdates({
      onDisconnect: startFallbackPolling,
      onUpdate: () => void loadAvailability(),
    });

    return () => {
      unsubscribe();

      if (pollingInterval !== undefined) {
        window.clearInterval(pollingInterval);
      }
    };
  }, [loadAvailability, parkingEventsApi]);

  if (status === "loading") {
    return (
      <DashboardState title="Loading availability..." variant="loading">
        Campus occupancy data is being refreshed.
      </DashboardState>
    );
  }

  if (status === "error") {
    return (
      <DashboardState
        actionLabel="Retry"
        onAction={() => void loadAvailability()}
        title="Unable to load availability"
        variant="error"
      >
        {error}
      </DashboardState>
    );
  }

  if (status === "empty" || !summary) {
    return (
      <DashboardState title="No parking availability yet" variant="empty">
        Zone availability will appear after parking zones and spots are added.
      </DashboardState>
    );
  }

  return (
    <section className="parking-dashboard-page" aria-labelledby="parking-dashboard-title">
      <div className="parking-dashboard-header">
        <h1 id="parking-dashboard-title">Welcome to UniPark</h1>
        <p>Real-time campus parking availability across every active zone.</p>
      </div>

      <div className="parking-stat-grid" aria-label="Campus availability summary">
        {buildDashboardStats(summary).map((stat) => (
          <article className="parking-stat-card" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>

      <SmartSuggestionsPanel
        error={recommendationError}
        onRetry={() => void loadRecommendations()}
        recommendations={recommendations}
        status={recommendationStatus}
      />

      <PredictiveAvailabilityPanel
        error={predictionError}
        onPredict={() => void requestPrediction()}
        onRetry={() => void requestPrediction()}
        onTargetTimeChange={setPredictionTargetTime}
        onZoneChange={setSelectedPredictionZoneId}
        prediction={prediction}
        selectedZoneId={selectedPredictionZoneId}
        status={predictionZoneOptions.length === 0 ? "empty" : predictionStatus}
        targetTime={predictionTargetTime}
        zones={predictionZoneOptions}
      />

      <section className="zone-availability-panel" aria-labelledby="zone-availability-title">
        <div className="zone-availability-heading">
          <div>
            <h2 id="zone-availability-title">Zone Status</h2>
            <p>{getCampusOccupancyRate(summary)} campus occupancy</p>
          </div>
          <span className="availability-status availability-status-open">
            Live availability
          </span>
        </div>

        <div className="zone-availability-list">
          {summary.zones.map((zone) => (
            <ZoneAvailabilityRow key={zone.zoneId} zone={zone} />
          ))}
        </div>
      </section>
    </section>
  );
}

function PredictiveAvailabilityPanel({
  error,
  onPredict,
  onRetry,
  onTargetTimeChange,
  onZoneChange,
  prediction,
  selectedZoneId,
  status,
  targetTime,
  zones,
}: {
  error: string | null;
  onPredict: () => void;
  onRetry: () => void;
  onTargetTimeChange: (value: string) => void;
  onZoneChange: (value: string) => void;
  prediction: PredictiveAvailabilityResult | null;
  selectedZoneId: string;
  status: PredictionStatus;
  targetTime: string;
  zones: PredictionZoneOption[];
}) {
  return (
    <section className="prediction-panel" aria-labelledby="prediction-panel-title">
      <div className="prediction-heading">
        <div>
          <h2 id="prediction-panel-title">Predictive Availability</h2>
          <p>Check likely availability for a future arrival time.</p>
        </div>
      </div>

      <form
        className="prediction-form"
        onSubmit={(event) => {
          event.preventDefault();
          onPredict();
        }}
      >
        <label className="prediction-field">
          <span>Zone</span>
          <select
            disabled={zones.length === 0}
            onChange={(event) => onZoneChange(event.target.value)}
            value={selectedZoneId}
          >
            {zones.length === 0 ? <option value="">No zones available</option> : null}
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>

        <label className="prediction-field">
          <span>Arrival time</span>
          <input
            min={toDateTimeLocalValue(new Date())}
            onChange={(event) => onTargetTimeChange(event.target.value)}
            type="datetime-local"
            value={targetTime}
          />
        </label>

        <button className="primary-button prediction-submit" disabled={status === "loading"} type="submit">
          {status === "loading" ? "Checking..." : "Check availability"}
        </button>
      </form>

      {status === "empty" ? (
        <PredictionState title="No zones available">
          Add parking zones before requesting a future availability prediction.
        </PredictionState>
      ) : null}

      {status === "validation" ? (
        <PredictionState title="Check the prediction details">{error}</PredictionState>
      ) : null}

      {status === "permission" ? (
        <PredictionState title="Predictions unavailable">{error}</PredictionState>
      ) : null}

      {status === "error" ? (
        <PredictionState actionLabel="Retry" onAction={onRetry} title="Unable to predict availability">
          {error}
        </PredictionState>
      ) : null}

      {status === "loading" ? (
        <PredictionState title="Checking availability">
          Comparing the selected arrival time with current and historical zone data.
        </PredictionState>
      ) : null}

      {status === "ready" && prediction ? (
        <article className="prediction-result-card" aria-live="polite">
          <div>
            <span>Predicted zone</span>
            <h3>{prediction.zoneName}</h3>
            <p>{formatPredictionTargetTime(prediction.targetTime)}</p>
          </div>
          <dl>
            <div>
              <dt>Available</dt>
              <dd>
                {prediction.predictedAvailableSpots} / {prediction.capacity}
              </dd>
            </div>
            <div>
              <dt>Occupancy</dt>
              <dd>{formatPredictionOccupancy(prediction)}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{formatPredictionConfidence(prediction.confidenceLabel)}</dd>
            </div>
          </dl>
          <p>{prediction.basis}</p>
        </article>
      ) : null}
    </section>
  );
}

function PredictionState({
  actionLabel,
  children,
  onAction,
  title,
}: {
  actionLabel?: string;
  children: string | null;
  onAction?: () => void;
  title: string;
}) {
  return (
    <div className="prediction-state">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {actionLabel && onAction ? (
        <button className="secondary-button" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function SmartSuggestionsPanel({
  error,
  onRetry,
  recommendations,
  status,
}: {
  error: string | null;
  onRetry: () => void;
  recommendations: RecommendationResponse | null;
  status: RecommendationStatus;
}) {
  return (
    <section className="smart-suggestions-panel" aria-labelledby="smart-suggestions-title">
      <div className="smart-suggestions-heading">
        <div>
          <h2 id="smart-suggestions-title">Smart Suggestions</h2>
          <p>Current-status recommendations for choosing a parking zone.</p>
        </div>
      </div>

      {status === "loading" || status === "idle" ? (
        <SmartSuggestionState title="Loading suggestions">
          Finding the best zones from live parking status.
        </SmartSuggestionState>
      ) : null}

      {status === "permission" ? (
        <SmartSuggestionState title="Suggestions unavailable">{error}</SmartSuggestionState>
      ) : null}

      {status === "error" ? (
        <SmartSuggestionState actionLabel="Retry" onAction={onRetry} title="Unable to load suggestions">
          {error}
        </SmartSuggestionState>
      ) : null}

      {status === "empty" ? (
        <SmartSuggestionState title="No suggestions available">
          No zone currently has available spots.
        </SmartSuggestionState>
      ) : null}

      {status === "ready" && recommendations ? (
        <div className="smart-suggestions-grid">
          <RecommendationCard
            label="Nearest available"
            recommendation={recommendations.nearestAvailableZone}
          />
          <RecommendationCard
            label="Least congested"
            recommendation={recommendations.leastCongestedZone}
          />
        </div>
      ) : null}
    </section>
  );
}

function RecommendationCard({
  label,
  recommendation,
}: {
  label: string;
  recommendation: ZoneRecommendation | null;
}) {
  if (!recommendation) {
    return (
      <article className="smart-suggestion-card smart-suggestion-card-empty">
        <span>{label}</span>
        <h3>No zone available</h3>
        <p>Check the parking map for the latest spot status.</p>
      </article>
    );
  }

  return (
    <article className="smart-suggestion-card">
      <span>{label}</span>
      <h3>{recommendation.zoneName}</h3>
      <dl>
        <div>
          <dt>Availability</dt>
          <dd>{formatRecommendationAvailability(recommendation)}</dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>{formatRecommendationDistance(recommendation)}</dd>
        </div>
        <div>
          <dt>Occupancy</dt>
          <dd>{recommendation.occupancyRate.toFixed(2)}%</dd>
        </div>
      </dl>
      <p>{recommendation.reason}</p>
    </article>
  );
}

function SmartSuggestionState({
  actionLabel,
  children,
  onAction,
  title,
}: {
  actionLabel?: string;
  children: string | null;
  onAction?: () => void;
  title: string;
}) {
  return (
    <div className="smart-suggestion-state">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {actionLabel && onAction ? (
        <button className="secondary-button" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function ZoneAvailabilityRow({ zone }: { zone: ZoneOccupancySummary }) {
  const availablePercentage = getZoneAvailablePercentage(zone);
  const tone = getZoneAvailabilityTone(zone);
  const label = getZoneAvailabilityLabel(zone);

  return (
    <article className="zone-availability-row">
      <div className="zone-availability-copy">
        <div>
          <h3>{zone.name}</h3>
          {zone.description ? <p>{zone.description}</p> : null}
        </div>
        <span className={`availability-status availability-status-${tone}`}>
          {label}
        </span>
      </div>
      <div className="zone-progress-line" aria-hidden="true">
        <span
          className={`zone-progress-fill zone-progress-fill-${tone}`}
          style={{ width: `${availablePercentage}%` }}
        />
      </div>
      <p className="zone-availability-count">
        {zone.availableSpots} / {zone.capacity} available
      </p>
    </article>
  );
}

function DashboardState({
  actionLabel,
  children,
  onAction,
  title,
  variant,
}: {
  actionLabel?: string;
  children: string | null;
  onAction?: () => void;
  title: string;
  variant: "loading" | "empty" | "error";
}) {
  return (
    <section className={`dashboard-state dashboard-state-${variant}`} aria-live="polite">
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {variant === "loading" ? <span className="loading-ring" aria-hidden="true" /> : null}
      {actionLabel && onAction ? (
        <button className="primary-button" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
