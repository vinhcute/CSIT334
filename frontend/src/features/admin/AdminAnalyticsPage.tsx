import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, ApiResponseFormatError, createApiClient } from "../../services/apiClient.js";
import {
  createAnalyticsApi,
  type AnalyticsRange,
  type AnalyticsSummary,
  type OccupancyTrendPoint,
  type PeakHourSummary,
  type ZoneUtilisationSummary,
} from "../../services/analyticsApi.js";
import { useAuthState } from "../auth/authState.js";
import type { SafeUser } from "../auth/authTypes.js";

const sharedApiClient = createApiClient();

type AdminAnalyticsStatus = "loading" | "ready" | "empty" | "error";

export const ANALYTICS_RANGE_OPTIONS: AnalyticsRange[] = ["today", "week", "month"];

export interface AnalyticsStatCard {
  label: string;
  value: string;
}

export function canViewAdminAnalytics(user: SafeUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function isAnalyticsRange(value: string): value is AnalyticsRange {
  return ANALYTICS_RANGE_OPTIONS.includes(value as AnalyticsRange);
}

export function getAnalyticsRangeLabel(range: AnalyticsRange): string {
  const labels: Record<AnalyticsRange, string> = {
    today: "Today",
    week: "Last 7 days",
    month: "Last 30 days",
  };

  return labels[range];
}

export function getAnalyticsErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { error?: string; issues?: string[] } | null;

    if (body?.issues?.length) {
      return body.issues.join(" ");
    }

    if (body?.error) {
      return body.error;
    }

    if (error.status === 403) {
      return "Permission denied. Admin access is required.";
    }
  }

  if (error instanceof ApiResponseFormatError) {
    return "The analytics API returned a non-JSON response. Rebuild and restart the backend server, then retry.";
  }

  return "Unable to load admin analytics. Please check the API server and try again.";
}

export function hasAnalyticsData(summary: AnalyticsSummary | null): boolean {
  return Boolean(
    summary &&
      (summary.totalCapacity > 0 ||
        summary.occupancyTrends.length > 0 ||
        summary.peakHours.length > 0 ||
        summary.zoneUtilisation.length > 0),
  );
}

export function buildAnalyticsStatCards(summary: AnalyticsSummary): AnalyticsStatCard[] {
  return [
    { label: "Total Capacity", value: String(summary.totalCapacity) },
    { label: "Available Spots", value: String(summary.totalAvailableSpots) },
    { label: "Average Occupancy", value: formatPercent(summary.averageOccupancyRate) },
    {
      label: "Maintenance",
      value: String(summary.totalMaintenanceRequiredSpots),
    },
  ];
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatAnalyticsTime(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function getTrendWidth(point: OccupancyTrendPoint): string {
  return `${Math.min(Math.max(point.occupancyRate, 0), 100)}%`;
}

export function getUtilisationWidth(zone: ZoneUtilisationSummary): string {
  return `${Math.min(Math.max(zone.utilisationRate, 0), 100)}%`;
}

export function getTopPeakHours(peakHours: PeakHourSummary[], limit = 4): PeakHourSummary[] {
  return peakHours.slice(0, limit);
}

export function AdminAnalyticsPage() {
  const { user } = useAuthState();
  const analyticsApi = useMemo(() => createAnalyticsApi(sharedApiClient), []);
  const [range, setRange] = useState<AnalyticsRange>("today");
  const [status, setStatus] = useState<AdminAnalyticsStatus>("loading");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!canViewAdminAnalytics(user)) {
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const result = await analyticsApi.getSummary(range);

      setSummary(result.summary);
      setStatus(hasAnalyticsData(result.summary) ? "ready" : "empty");
    } catch (loadError) {
      setSummary(null);
      setStatus("error");
      setError(getAnalyticsErrorMessage(loadError));
    }
  }, [analyticsApi, range, user]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  if (!canViewAdminAnalytics(user)) {
    return (
      <AnalyticsState title="Permission denied" variant="permission">
        This page is only available to administrator accounts.
      </AnalyticsState>
    );
  }

  return (
    <section className="admin-analytics-page" aria-labelledby="admin-analytics-title">
      <div className="admin-analytics-header">
        <div>
          <p className="eyebrow">Admin Analytics</p>
          <h1 id="admin-analytics-title">Campus Analytics</h1>
          <p>Real-time oversight of campus parking utilisation and peak demand.</p>
        </div>

        <label className="analytics-range-control">
          <span>Range</span>
          <select
            aria-label="Analytics range"
            onChange={(event) => {
              const nextRange = event.target.value;

              if (isAnalyticsRange(nextRange)) {
                setRange(nextRange);
              }
            }}
            value={range}
          >
            {ANALYTICS_RANGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {getAnalyticsRangeLabel(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {status === "loading" ? (
        <AnalyticsState title="Loading analytics..." variant="loading">
          Campus utilisation data is being refreshed.
        </AnalyticsState>
      ) : null}

      {status === "error" ? (
        <AnalyticsState
          actionLabel="Retry"
          onAction={() => void loadAnalytics()}
          title="Unable to load analytics"
          variant="error"
        >
          {error}
        </AnalyticsState>
      ) : null}

      {status === "empty" ? (
        <AnalyticsState title="No analytics data yet" variant="empty">
          Analytics will appear after occupancy history and parking zones are available.
        </AnalyticsState>
      ) : null}

      {status === "ready" && summary ? <AnalyticsContent summary={summary} /> : null}
    </section>
  );
}

function AnalyticsContent({ summary }: { summary: AnalyticsSummary }) {
  const peakHours = getTopPeakHours(summary.peakHours);

  return (
    <>
      <div className="analytics-stat-grid" aria-label="Analytics summary cards">
        {buildAnalyticsStatCards(summary).map((stat) => (
          <article className="analytics-stat-card" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>

      <section className="analytics-panel" aria-labelledby="analytics-trends-title">
        <div className="analytics-panel-heading">
          <h2 id="analytics-trends-title">Lot Utilisation Over Time</h2>
          <span>{getAnalyticsRangeLabel(summary.range)}</span>
        </div>

        {summary.occupancyTrends.length > 0 ? (
          <div className="analytics-trend-list">
            {summary.occupancyTrends.slice(0, 8).map((point) => (
              <article
                className="analytics-trend-row"
                key={`${point.zoneId ?? "campus"}-${point.recordedAt}`}
              >
                <div>
                  <strong>{point.zoneName ?? "Campus"}</strong>
                  <span>{formatAnalyticsTime(point.recordedAt)}</span>
                </div>
                <div className="analytics-meter" aria-hidden="true">
                  <span style={{ width: getTrendWidth(point) }} />
                </div>
                <p>{formatPercent(point.occupancyRate)} occupied</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="analytics-muted">No occupancy trend samples are available for this range.</p>
        )}
      </section>

      <div className="analytics-secondary-grid">
        <section className="analytics-panel" aria-labelledby="peak-hours-title">
          <h2 id="peak-hours-title">Peak Hours</h2>
          {peakHours.length > 0 ? (
            <div className="analytics-peak-list">
              {peakHours.map((hour) => (
                <article className="analytics-peak-row" key={hour.hour}>
                  <strong>{hour.hourLabel}</strong>
                  <span>{formatPercent(hour.averageOccupancyRate)}</span>
                  <small>{hour.sampleCount} samples</small>
                </article>
              ))}
            </div>
          ) : (
            <p className="analytics-muted">No peak-hour samples are available.</p>
          )}
        </section>

        <section className="analytics-panel" aria-labelledby="zone-utilisation-title">
          <h2 id="zone-utilisation-title">Zone Utilisation</h2>
          {summary.zoneUtilisation.length > 0 ? (
            <div className="analytics-zone-list">
              {summary.zoneUtilisation.map((zone) => (
                <article className="analytics-zone-row" key={zone.zoneId}>
                  <div>
                    <strong>{zone.zoneName}</strong>
                    <span>
                      {zone.availableSpots} available / {zone.capacity} capacity
                    </span>
                  </div>
                  <div className="analytics-meter" aria-hidden="true">
                    <span style={{ width: getUtilisationWidth(zone) }} />
                  </div>
                  <small>
                    {formatPercent(zone.utilisationRate)} utilised, {zone.maintenanceRequiredSpots} maintenance
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p className="analytics-muted">No parking zones are available for utilisation.</p>
          )}
        </section>
      </div>
    </>
  );
}

function AnalyticsState({
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
  variant: "loading" | "empty" | "error" | "permission";
}) {
  return (
    <section className={`analytics-state analytics-state-${variant}`} aria-live="polite">
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
