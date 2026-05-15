import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, createApiClient } from "../../services/apiClient.js";
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
import {
  createParkingZonesApi,
  type ParkingZone,
} from "../../services/parkingZonesApi.js";
import { useAuthState } from "../auth/authState.js";
import type { SafeUser } from "../auth/authTypes.js";

const sharedApiClient = createApiClient();

export type AdminParkingInventoryView = "zones" | "spots";
type InventoryStatus = "loading" | "ready" | "empty" | "error";

export interface ParkingInventoryViewModel {
  zones: Array<ParkingZone & Partial<ZoneOccupancySummary>>;
  spots: ParkingSpot[];
  summary: OccupancySummary | null;
}

export function canViewAdminParkingInventory(user: SafeUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function getParkingSpotStatusText(status: ParkingSpotStatus): string {
  const statusTextByStatus: Record<ParkingSpotStatus, string> = {
    available: "Available",
    occupied: "Occupied",
    reserved: "Reserved",
    maintenanceRequired: "Maintenance",
  };

  return statusTextByStatus[status];
}

export function getParkingSpotStatusClass(status: ParkingSpotStatus): string {
  return `parking-status parking-status-${status}`;
}

export function hasParkingInventory(viewModel: ParkingInventoryViewModel): boolean {
  return viewModel.zones.length > 0 || viewModel.spots.length > 0;
}

export function mergeZonesWithOccupancy(
  zones: ParkingZone[],
  summary: OccupancySummary | null,
): Array<ParkingZone & Partial<ZoneOccupancySummary>> {
  return zones.map((zone) => {
    const zoneSummary = summary?.zones.find((candidate) => candidate.zoneId === zone.id);

    return zoneSummary ? { ...zone, ...zoneSummary } : zone;
  });
}

export function getParkingInventoryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { error?: string; issues?: string[] } | null;

    if (body?.issues?.length) {
      return body.issues.join(" ");
    }

    if (body?.error) {
      return body.error;
    }
  }

  return "Unable to load parking inventory. Please retry after checking the API server.";
}

interface AdminParkingInventoryPageProps {
  initialView?: AdminParkingInventoryView;
  onReturnDashboard?: () => void;
}

export function AdminParkingInventoryPage({
  initialView = "zones",
  onReturnDashboard,
}: AdminParkingInventoryPageProps) {
  const { user } = useAuthState();
  const parkingZonesApi = useMemo(() => createParkingZonesApi(sharedApiClient), []);
  const parkingSpotsApi = useMemo(() => createParkingSpotsApi(sharedApiClient), []);
  const occupancyApi = useMemo(() => createOccupancyApi(sharedApiClient), []);
  const [activeView, setActiveView] = useState<AdminParkingInventoryView>(initialView);
  const [status, setStatus] = useState<InventoryStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<ParkingInventoryViewModel>({
    zones: [],
    spots: [],
    summary: null,
  });

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  const loadInventory = useCallback(async () => {
    if (!canViewAdminParkingInventory(user)) {
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const [zonesResult, spotsResult, occupancyResult] = await Promise.all([
        parkingZonesApi.listZones(),
        parkingSpotsApi.listSpots(),
        occupancyApi.getSummary(),
      ]);
      const nextInventory = {
        zones: mergeZonesWithOccupancy(
          zonesResult.parkingZones,
          occupancyResult.summary,
        ),
        spots: spotsResult.parkingSpots,
        summary: occupancyResult.summary,
      };

      setInventory(nextInventory);
      setStatus(hasParkingInventory(nextInventory) ? "ready" : "empty");
    } catch (loadError) {
      setStatus("error");
      setError(getParkingInventoryErrorMessage(loadError));
    }
  }, [occupancyApi, parkingSpotsApi, parkingZonesApi, user]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  if (!canViewAdminParkingInventory(user)) {
    return (
      <section className="inventory-state inventory-state-permission" aria-live="polite">
        <h2>Permission denied</h2>
        <p>This page is only available to administrator accounts.</p>
        {onReturnDashboard ? (
          <button className="primary-button" onClick={onReturnDashboard} type="button">
            Return to Dashboard
          </button>
        ) : null}
      </section>
    );
  }

  if (status === "loading") {
    return (
      <section className="inventory-state inventory-state-loading" aria-live="polite">
        <h2>Loading parking data...</h2>
        <span className="loading-ring" aria-hidden="true" />
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="inventory-state inventory-state-error" aria-live="polite">
        <h2>Unable to load data</h2>
        <p>{error}</p>
        <button className="danger-button" onClick={() => void loadInventory()} type="button">
          Retry
        </button>
      </section>
    );
  }

  if (status === "empty") {
    return (
      <section className="inventory-state inventory-state-empty" aria-live="polite">
        <h2>No parking inventory yet</h2>
        <p>Parking zones and spots will appear here after admin setup data is available.</p>
      </section>
    );
  }

  return (
    <section className="admin-inventory-page" aria-labelledby="admin-inventory-title">
      <div className="inventory-header">
        <p className="eyebrow">Admin Parking Controls</p>
        <h2 id="admin-inventory-title">
          {activeView === "zones" ? "Zone Management" : "Spot Management"}
        </h2>
        <p>
          {activeView === "zones"
            ? "Manage campus parking zones, capacity, and operational status"
            : "Update individual parking spot availability and maintenance state"}
        </p>
      </div>

      <div className="inventory-tabs" aria-label="Parking inventory views">
        <button
          className={activeView === "zones" ? "inventory-tab inventory-tab-active" : "inventory-tab"}
          onClick={() => setActiveView("zones")}
          type="button"
        >
          Zones
        </button>
        <button
          className={activeView === "spots" ? "inventory-tab inventory-tab-active" : "inventory-tab"}
          onClick={() => setActiveView("spots")}
          type="button"
        >
          Spots
        </button>
      </div>

      {activeView === "zones" ? (
        <ParkingZonesTable zones={inventory.zones} />
      ) : (
        <ParkingSpotsTable spots={inventory.spots} zones={inventory.zones} />
      )}
    </section>
  );
}

function ParkingZonesTable({
  zones,
}: {
  zones: Array<ParkingZone & Partial<ZoneOccupancySummary>>;
}) {
  return (
    <div className="inventory-table-card inventory-table-card-wide" role="table" aria-label="Parking zones">
      <div className="inventory-table-title">Parking Zones</div>
      <div className="inventory-row inventory-row-heading" role="row">
        <span role="columnheader">Zone</span>
        <span role="columnheader">Capacity</span>
        <span role="columnheader">Available</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Occupancy</span>
      </div>
      {zones.map((zone) => {
        const occupancyRate = zone.occupancyRate ?? "0.00";
        const status = Number.parseFloat(occupancyRate) >= 90 ? "Restricted" : "Active";

        return (
          <div className="inventory-row" key={zone.id} role="row">
            <span role="cell">
              <strong>{zone.name}</strong>
              {zone.description ? <small>{zone.description}</small> : null}
            </span>
            <span role="cell">{zone.capacity}</span>
            <span role="cell">{zone.availableSpots ?? 0}</span>
            <span role="cell">{status}</span>
            <span role="cell">{occupancyRate}%</span>
          </div>
        );
      })}
    </div>
  );
}

function ParkingSpotsTable({
  spots,
  zones,
}: {
  spots: ParkingSpot[];
  zones: Array<ParkingZone & Partial<ZoneOccupancySummary>>;
}) {
  const zoneNameById = new Map(zones.map((zone) => [zone.id, zone.name]));

  return (
    <div className="inventory-table-card inventory-table-card-wide" role="table" aria-label="Parking spots">
      <div className="inventory-table-title">Parking Spots</div>
      <div className="inventory-row inventory-row-heading" role="row">
        <span role="columnheader">Spot</span>
        <span role="columnheader">Zone</span>
        <span role="columnheader">Level</span>
        <span role="columnheader">Row</span>
        <span role="columnheader">Status</span>
      </div>
      {spots.map((spot) => (
        <div className="inventory-row" key={spot.id} role="row">
          <span role="cell">
            <strong>{spot.spotCode}</strong>
          </span>
          <span role="cell">{zoneNameById.get(spot.zoneId) ?? spot.zoneId}</span>
          <span role="cell">{spot.level ?? "Standard"}</span>
          <span role="cell">{spot.rowLabel ?? "Not set"}</span>
          <span role="cell">
            <span className={getParkingSpotStatusClass(spot.status)}>
              {getParkingSpotStatusText(spot.status)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
