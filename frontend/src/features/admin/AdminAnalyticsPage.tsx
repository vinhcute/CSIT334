import { useEffect, useMemo, useState } from "react";
import { ApiError, ApiResponseFormatError } from "../../services/apiClient.js";
import {
  createAnalyticsApi,
  type AnalyticsRange,
  type OccupancyTrendPoint,
  type ZoneUtilisationSummary,
} from "../../services/analyticsApi.js";
import { useAuthState } from "../auth/authState.js";
import type { SafeUser } from "../auth/authTypes.js";

export const ANALYTICS_RANGES: AnalyticsRange[] = ["today", "week", "month"];

export const seedOccupancyTrend: OccupancyTrendPoint[] = [
  { label: "08:00", occupancyRate: 42, availableSpots: 58 },
  { label: "10:00", occupancyRate: 67, availableSpots: 33 },
  { label: "12:00", occupancyRate: 74, availableSpots: 26 },
  { label: "14:00", occupancyRate: 81, availableSpots: 19 },
  { label: "16:00", occupancyRate: 63, availableSpots: 37 },
];

export const seedZoneUtilisation: ZoneUtilisationSummary[] = [
  {
    zoneName: "North Campus",
    utilisationRate: 82,
    availableSpots: 9,
    occupiedSpots: 37,
    reservedSpots: 4,
  },
  {
    zoneName: "Library Parking",
    utilisationRate: 76,
    availableSpots: 12,
    occupiedSpots: 31,
    reservedSpots: 7,
  },
  {
    zoneName: "East Gate",
    utilisationRate: 54,
    availableSpots: 23,
    occupiedSpots: 20,
    reservedSpots: 3,
  },
];

const analyticsApi = createAnalyticsApi();

export function canViewAdminAnalytics(user: SafeUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function getPeakHour(points: OccupancyTrendPoint[]): OccupancyTrendPoint | null {
  if (points.length === 0) {
    return null;
  }

  return points.reduce((peak, point) =>
    point.occupancyRate > peak.occupancyRate ? point : peak,
  );
}

export function getAverageOccupancy(points: OccupancyTrendPoint[]): number {
  if (points.length === 0) {
    return 0;
  }

  const total = points.reduce((sum, point) => sum + point.occupancyRate, 0);

  return Math.round(total / points.length);
}

export function getUtilisationStatus(rate: number): "open" | "busy" | "critical" {
  if (rate >= 80) {
    return "critical";
  }

  if (rate >= 65) {
    return "busy";
  }

  return "open";
}

export function getUtilisationStatusLabel(status: ReturnType<typeof getUtilisationStatus>) {
  const labels: Record<ReturnType<typeof getUtilisationStatus>, string> = {
    open: "Open",
    busy: "Busy",
    critical: "Critical",
  };

  return labels[status];
}

export function AdminAnalyticsPage() {
  const { user } = useAuthState();
  const [range, setRange] = useState<AnalyticsRange>("today");
  const [occupancyTrend, setOccupancyTrend] =
    useState<OccupancyTrendPoint[]>(seedOccupancyTrend);
  const [zoneUtilisation, setZoneUtilisation] =
    useState<ZoneUtilisationSummary[]>(seedZoneUtilisation);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const peakHour = useMemo(() => getPeakHour(occupancyTrend), [occupancyTrend]);
  const averageOccupancy = useMemo(
    () => getAverageOccupancy(occupancyTrend),
    [occupancyTrend],
  );
  const totalAvailable = zoneUtilisation.reduce(
    (sum, zone) => sum + zone.availableSpots,
    0,
  );

  useEffect(() => {
    if (!canViewAdminAnalytics(user)) {
      return;
    }

    let isMounted = true;

    async function loadAnalytics() {
      setLoadStatus("loading");
      setLoadError(null);

      try {
        const response = await analyticsApi.getCampusAnalytics(range);

        if (!isMounted) {
          return;
        }

        setOccupancyTrend(response.analytics.occupancyTrend);
        setZoneUtilisation(response.analytics.zoneUtilisation);
        setLoadStatus("ready");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(getAnalyticsErrorMessage(error));
        setLoadStatus("error");
      }
    }

    void loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, [range, user]);

  if (!canViewAdminAnalytics(user)) {
    return (
      <section className="account-state account-state-error admin-state" aria-live="polite">
        <h2>Permission denied</h2>
        <p>Analytics are only available to administrator accounts.</p>
      </section>
    );
  }

  return (
    <section className="admin-analytics-page" aria-labelledby="admin-analytics-title">
      <header className="admin-analytics-header">
        <div>
          <p className="eyebrow">Campus Analytics</p>
          <h1 id="admin-analytics-title">Campus Analytics</h1>
          <p>Monitor occupancy trends, peak-hour demand, and zone utilisation.</p>
        </div>
        <label className="analytics-range-filter">
          <span className="sr-only">Select analytics range</span>
          <select
            onChange={(event) => setRange(event.target.value as AnalyticsRange)}
            value={range}
          >
            {ANALYTICS_RANGES.map((rangeOption) => (
              <option key={rangeOption} value={rangeOption}>
                {formatRangeLabel(rangeOption)}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="analytics-stat-grid" aria-label="Analytics summary">
        <AnalyticsStatCard label="Average Occupancy" value={`${averageOccupancy}%`} />
        <AnalyticsStatCard label="Peak Hour" value={peakHour?.label ?? "N/A"} />
        <AnalyticsStatCard label="Available Now" value={totalAvailable.toString()} />
      </div>

      {loadStatus === "error" && loadError ? (
        <p className="form-banner-error incident-feedback" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="admin-analytics-layout">
        <section className="analytics-panel analytics-trend-panel">
          <div className="analytics-panel-heading">
            <h2>Occupancy Trend</h2>
            <p>
              {loadStatus === "loading"
                ? "Loading demand pattern"
                : `${formatRangeLabel(range)} demand pattern`}
            </p>
          </div>
          <div className="trend-chart" aria-label="Occupancy trend chart">
            {occupancyTrend.map((point) => (
              <div className="trend-bar-column" key={point.label}>
                <span className="trend-bar-value">{point.occupancyRate}%</span>
                <span
                  aria-label={`${point.label} occupancy ${point.occupancyRate}%`}
                  className="trend-bar"
                  style={{ height: `${Math.max(point.occupancyRate, 12)}%` }}
                />
                <span className="trend-bar-label">{point.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="analytics-panel peak-hour-panel">
          <div className="analytics-panel-heading">
            <h2>Peak Hour</h2>
            <p>Highest average occupancy</p>
          </div>
          {peakHour ? (
            <div className="peak-hour-card">
              <strong>{peakHour.label}</strong>
              <span>{peakHour.occupancyRate}% occupied</span>
              <p>{peakHour.availableSpots} spots usually remain available.</p>
            </div>
          ) : (
            <p className="sensor-muted">No peak-hour data available.</p>
          )}
        </section>

        <section className="analytics-panel zone-utilisation-panel">
          <div className="analytics-panel-heading">
            <h2>Zone Utilisation</h2>
            <p>Current utilisation by parking zone</p>
          </div>
          <div className="zone-utilisation-list">
            {zoneUtilisation.map((zone) => {
              const status = getUtilisationStatus(zone.utilisationRate);

              return (
                <article className="zone-utilisation-row" key={zone.zoneName}>
                  <div className="zone-utilisation-copy">
                    <div>
                      <h3>{zone.zoneName}</h3>
                      <p>
                        {zone.occupiedSpots} occupied, {zone.reservedSpots} reserved,{" "}
                        {zone.availableSpots} available
                      </p>
                    </div>
                    <span className={`utilisation-status utilisation-status-${status}`}>
                      {getUtilisationStatusLabel(status)}
                    </span>
                  </div>
                  <div className="zone-progress-line analytics-progress-line">
                    <span
                      className={`zone-progress-fill analytics-progress-fill analytics-progress-fill-${status}`}
                      style={{ width: `${zone.utilisationRate}%` }}
                    />
                  </div>
                  <span className="zone-availability-count">
                    {zone.utilisationRate}% utilisation
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

function AnalyticsStatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="parking-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatRangeLabel(range: AnalyticsRange): string {
  const labels: Record<AnalyticsRange, string> = {
    today: "Today",
    week: "This Week",
    month: "This Month",
  };

  return labels[range];
}

function getAnalyticsErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body;

    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  }

  if (error instanceof ApiResponseFormatError) {
    return error.message;
  }

  return "Unable to load campus analytics. Please try again.";
}
