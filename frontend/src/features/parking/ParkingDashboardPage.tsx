import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, ApiResponseFormatError, createApiClient } from "../../services/apiClient.js";
import {
  createOccupancyApi,
  type OccupancySummary,
  type ZoneOccupancySummary,
} from "../../services/occupancyApi.js";
import { createParkingEventsApi } from "../../services/parkingEventsApi.js";

const sharedApiClient = createApiClient();

type DashboardStatus = "loading" | "ready" | "empty" | "error";
type AvailabilityTone = "open" | "limited" | "full" | "empty";

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

export function ParkingDashboardPage() {
  const occupancyApi = useMemo(() => createOccupancyApi(sharedApiClient), []);
  const parkingEventsApi = useMemo(() => createParkingEventsApi(sharedApiClient), []);
  const [status, setStatus] = useState<DashboardStatus>("loading");
  const [summary, setSummary] = useState<OccupancySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

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
