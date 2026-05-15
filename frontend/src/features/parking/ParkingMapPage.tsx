import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, ApiResponseFormatError, createApiClient } from "../../services/apiClient.js";
import {
  createOccupancyApi,
  type OccupancySummary,
  type ZoneOccupancySummary,
} from "../../services/occupancyApi.js";
import {
  createParkingSpotsApi,
  type ParkingSpot,
  type ParkingSpotStatus,
} from "../../services/parkingSpotsApi.js";
import { createParkingEventsApi } from "../../services/parkingEventsApi.js";

const sharedApiClient = createApiClient();

type ParkingMapStatus = "loading" | "ready" | "empty" | "error";

export interface ParkingMapViewModel {
  zones: ZoneOccupancySummary[];
  spots: ParkingSpot[];
}

export const PARKING_MAP_STATUS_ORDER: ParkingSpotStatus[] = [
  "available",
  "occupied",
  "reserved",
  "maintenanceRequired",
];

export function hasParkingMapData(viewModel: ParkingMapViewModel): boolean {
  return viewModel.zones.length > 0 && viewModel.spots.length > 0;
}

export function getParkingMapStatusText(status: ParkingSpotStatus): string {
  const textByStatus: Record<ParkingSpotStatus, string> = {
    available: "Available",
    occupied: "Occupied",
    reserved: "Reserved",
    maintenanceRequired: "Maintenance",
  };

  return textByStatus[status];
}

export function getParkingMapStatusClass(status: ParkingSpotStatus): string {
  return `map-status map-status-${status}`;
}

export function getParkingSpotTileClass(status: ParkingSpotStatus, isSelected = false): string {
  return [
    "parking-map-spot",
    `parking-map-spot-${status}`,
    isSelected ? "parking-map-spot-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function getParkingMapErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { error?: string } | null;

    if (body?.error) {
      return body.error;
    }
  }

  if (error instanceof ApiResponseFormatError) {
    return "The parking map API returned a non-JSON response. Rebuild and restart the backend server, then retry.";
  }

  return "Unable to load parking map data. Please check the API server and try again.";
}

export function filterParkingSpotsByZone(spots: ParkingSpot[], zoneId: string): ParkingSpot[] {
  return zoneId === "all" ? spots : spots.filter((spot) => spot.zoneId === zoneId);
}

export function getZoneNameById(zones: ZoneOccupancySummary[]): Map<string, string> {
  return new Map(zones.map((zone) => [zone.zoneId, zone.name]));
}

export function ParkingMapPage() {
  const occupancyApi = useMemo(() => createOccupancyApi(sharedApiClient), []);
  const parkingSpotsApi = useMemo(() => createParkingSpotsApi(sharedApiClient), []);
  const parkingEventsApi = useMemo(() => createParkingEventsApi(sharedApiClient), []);
  const [status, setStatus] = useState<ParkingMapStatus>("loading");
  const [viewModel, setViewModel] = useState<ParkingMapViewModel>({
    zones: [],
    spots: [],
  });
  const [selectedZoneId, setSelectedZoneId] = useState("all");
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadParkingMap = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const [summaryResponse, spotsResponse] = await Promise.all([
        occupancyApi.getSummary(),
        parkingSpotsApi.listSpots(),
      ]);
      const nextViewModel = {
        zones: summaryResponse.summary.zones,
        spots: spotsResponse.parkingSpots,
      };

      setViewModel(nextViewModel);
      setSelectedSpotId(spotsResponse.parkingSpots[0]?.id ?? null);
      setStatus(hasParkingMapData(nextViewModel) ? "ready" : "empty");
    } catch (loadError) {
      setStatus("error");
      setError(getParkingMapErrorMessage(loadError));
    }
  }, [occupancyApi, parkingSpotsApi]);

  useEffect(() => {
    void loadParkingMap();
  }, [loadParkingMap]);

  useEffect(() => {
    let pollingInterval: number | undefined;
    const startFallbackPolling = () => {
      if (pollingInterval !== undefined) {
        return;
      }

      pollingInterval = window.setInterval(() => {
        void loadParkingMap();
      }, 3000);
    };
    const unsubscribe = parkingEventsApi.subscribeToParkingUpdates({
      onDisconnect: startFallbackPolling,
      onUpdate: () => void loadParkingMap(),
    });

    return () => {
      unsubscribe();

      if (pollingInterval !== undefined) {
        window.clearInterval(pollingInterval);
      }
    };
  }, [loadParkingMap, parkingEventsApi]);

  const visibleSpots = filterParkingSpotsByZone(viewModel.spots, selectedZoneId);
  const selectedSpot =
    visibleSpots.find((spot) => spot.id === selectedSpotId) ?? visibleSpots[0] ?? null;
  const zoneNameById = getZoneNameById(viewModel.zones);

  useEffect(() => {
    if (selectedSpot && selectedSpot.id !== selectedSpotId) {
      setSelectedSpotId(selectedSpot.id);
    }
  }, [selectedSpot, selectedSpotId]);

  if (status === "loading") {
    return (
      <MapState title="Loading parking map..." variant="loading">
        Campus zones and spot statuses are being refreshed.
      </MapState>
    );
  }

  if (status === "error") {
    return (
      <MapState
        actionLabel="Retry"
        onAction={() => void loadParkingMap()}
        title="Unable to load parking map"
        variant="error"
      >
        {error}
      </MapState>
    );
  }

  if (status === "empty") {
    return (
      <MapState title="No parking spots yet" variant="empty">
        Parking spots will appear after zones and spots are added.
      </MapState>
    );
  }

  return (
    <section className="parking-map-page" aria-labelledby="parking-map-title">
      <div className="parking-map-header">
        <div>
          <h1 id="parking-map-title">Parking Map</h1>
          <p>Interactive campus parking visualisation</p>
        </div>
        <label className="parking-map-filter">
          <span className="sr-only">Filter parking zone</span>
          <select
            onChange={(event) => {
              setSelectedZoneId(event.target.value);
              setSelectedSpotId(null);
            }}
            value={selectedZoneId}
          >
            <option value="all">All zones</option>
            {viewModel.zones.map((zone) => (
              <option key={zone.zoneId} value={zone.zoneId}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="parking-map-layout">
        <div>
          <div className="parking-map-grid" aria-label="Parking spots">
            {visibleSpots.map((spot) => (
              <button
                aria-label={`${spot.spotCode}: ${getParkingMapStatusText(spot.status)}`}
                className={getParkingSpotTileClass(spot.status, spot.id === selectedSpot?.id)}
                key={spot.id}
                onClick={() => setSelectedSpotId(spot.id)}
                title={`${spot.spotCode} - ${getParkingMapStatusText(spot.status)}`}
                type="button"
              >
                <span>{spot.spotCode}</span>
              </button>
            ))}
          </div>

          <div className="parking-map-legend" aria-label="Parking spot status legend">
            {PARKING_MAP_STATUS_ORDER.map((spotStatus) => (
              <span className={getParkingMapStatusClass(spotStatus)} key={spotStatus}>
                {getParkingMapStatusText(spotStatus)}
              </span>
            ))}
          </div>
        </div>

        <SelectedSpotPanel
          selectedSpot={selectedSpot}
          summary={viewModel.zones}
          zoneName={selectedSpot ? zoneNameById.get(selectedSpot.zoneId) ?? selectedSpot.zoneId : null}
        />
      </div>
    </section>
  );
}

function SelectedSpotPanel({
  selectedSpot,
  summary,
  zoneName,
}: {
  selectedSpot: ParkingSpot | null;
  summary: ZoneOccupancySummary[];
  zoneName: string | null;
}) {
  if (!selectedSpot) {
    return (
      <aside className="selected-spot-panel">
        <p className="eyebrow">Selected Spot</p>
        <h2>No spot selected</h2>
        <p className="selected-spot-copy">Choose a spot tile to inspect status details.</p>
      </aside>
    );
  }

  const zone = summary.find((candidate) => candidate.zoneId === selectedSpot.zoneId);

  return (
    <aside className="selected-spot-panel" aria-label="Selected parking spot">
      <p className="eyebrow">Selected Spot</p>
      <h2>
        {zoneName} • Spot {selectedSpot.spotCode}
      </h2>
      <span className={getParkingMapStatusClass(selectedSpot.status)}>
        {getParkingMapStatusText(selectedSpot.status)}
      </span>
      <dl className="selected-spot-list">
        <div>
          <dt>Level</dt>
          <dd>{selectedSpot.level ?? "Standard"}</dd>
        </div>
        <div>
          <dt>Row</dt>
          <dd>{selectedSpot.rowLabel ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Zone availability</dt>
          <dd>
            {zone ? `${zone.availableSpots} / ${zone.capacity} available` : "Not available"}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

function MapState({
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
    <section className={`map-state map-state-${variant}`} aria-live="polite">
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
