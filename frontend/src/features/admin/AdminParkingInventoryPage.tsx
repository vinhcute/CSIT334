import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { TextField } from "../../components/TextField.js";
import {
  ApiError,
  ApiResponseFormatError,
  createApiClient,
} from "../../services/apiClient.js";
import {
  createOccupancyApi,
  type OccupancySummary,
  type ZoneOccupancySummary,
} from "../../services/occupancyApi.js";
import {
  createParkingSpotsApi,
  type ParkingSpot,
  type ParkingSpotRequest,
  type ParkingSpotStatus,
} from "../../services/parkingSpotsApi.js";
import {
  createParkingZonesApi,
  type ParkingZone,
  type ParkingZoneRequest,
} from "../../services/parkingZonesApi.js";
import { useAuthState } from "../auth/authState.js";
import type { SafeUser } from "../auth/authTypes.js";

const sharedApiClient = createApiClient();
const PARKING_API_SERVER_HINT =
  "Make sure the backend API server is running on http://127.0.0.1:3000, then retry.";

export type AdminParkingInventoryView = "zones" | "spots";
type InventoryStatus = "loading" | "ready" | "empty" | "error";
type ZoneFormMode = "create" | "edit";
type SpotFormMode = "create" | "edit";

export const PARKING_SPOT_STATUS_OPTIONS: ParkingSpotStatus[] = [
  "available",
  "occupied",
  "reserved",
  "maintenanceRequired",
];

export interface ZoneFormValues {
  name: string;
  capacity: string;
  description: string;
  distanceFromEntryMeters: string;
  displayOrder: string;
}

export interface ZoneFormErrors {
  name?: string;
  capacity?: string;
  distanceFromEntryMeters?: string;
  displayOrder?: string;
}

export interface SpotFormValues {
  zoneId: string;
  spotCode: string;
  status: string;
  level: string;
  rowLabel: string;
}

export interface SpotFormErrors {
  zoneId?: string;
  spotCode?: string;
  status?: string;
}

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

export function isParkingSpotStatus(value: string): value is ParkingSpotStatus {
  return PARKING_SPOT_STATUS_OPTIONS.includes(value as ParkingSpotStatus);
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

  if (error instanceof Error) {
    if (error instanceof ApiResponseFormatError) {
      return "The parking API returned a non-JSON response. Rebuild and restart the backend server so the latest parking routes are running, then retry.";
    }

    if (
      error instanceof TypeError ||
      error.message.includes("Failed to fetch") ||
      error.message.includes("fetch failed")
    ) {
      return `Unable to reach the parking API. ${PARKING_API_SERVER_HINT}`;
    }
  }

  return `Unable to load parking inventory. ${PARKING_API_SERVER_HINT}`;
}

export function getOptionalOccupancyWarningMessage(error: unknown): string {
  return `Occupancy summary is unavailable. Zones and spots are still shown, but live availability counts may be incomplete. ${getParkingInventoryErrorMessage(error)}`;
}

export function getZoneAvailableSpotText(
  zone: ParkingZone & Partial<ZoneOccupancySummary>,
): string {
  return typeof zone.availableSpots === "number" ? String(zone.availableSpots) : "Not available";
}

export function getZoneOperationalStatus(
  zone: ParkingZone & Partial<ZoneOccupancySummary>,
): string {
  if (zone.occupancyRate === undefined) {
    return "Not available";
  }

  return Number.parseFloat(zone.occupancyRate) >= 90 ? "Restricted" : "Active";
}

export function createEmptyZoneFormValues(): ZoneFormValues {
  return {
    name: "",
    capacity: "",
    description: "",
    distanceFromEntryMeters: "",
    displayOrder: "",
  };
}

export function createZoneFormValues(zone: ParkingZone): ZoneFormValues {
  return {
    name: zone.name,
    capacity: String(zone.capacity),
    description: zone.description ?? "",
    distanceFromEntryMeters:
      zone.distanceFromEntryMeters === null ? "" : String(zone.distanceFromEntryMeters),
    displayOrder: String(zone.displayOrder),
  };
}

export function validateZoneForm(values: ZoneFormValues): ZoneFormErrors {
  const errors: ZoneFormErrors = {};
  const capacity = Number(values.capacity);
  const distanceFromEntryMeters =
    values.distanceFromEntryMeters.trim() === ""
      ? null
      : Number(values.distanceFromEntryMeters);
  const displayOrder =
    values.displayOrder.trim() === "" ? null : Number(values.displayOrder);

  if (values.name.trim() === "") {
    errors.name = "Zone name is required";
  }

  if (!Number.isInteger(capacity) || capacity < 1) {
    errors.capacity = "Capacity must be at least 1";
  }

  if (
    distanceFromEntryMeters !== null &&
    (!Number.isInteger(distanceFromEntryMeters) || distanceFromEntryMeters < 0)
  ) {
    errors.distanceFromEntryMeters = "Distance must be a whole number";
  }

  if (displayOrder !== null && (!Number.isInteger(displayOrder) || displayOrder < 0)) {
    errors.displayOrder = "Display order must be a whole number";
  }

  return errors;
}

export function zoneFormHasErrors(errors: ZoneFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function toParkingZoneRequest(values: ZoneFormValues): ParkingZoneRequest {
  return {
    name: values.name.trim(),
    capacity: Number(values.capacity),
    description: values.description.trim() || null,
    distanceFromEntryMeters:
      values.distanceFromEntryMeters.trim() === ""
        ? null
        : Number(values.distanceFromEntryMeters),
    displayOrder: values.displayOrder.trim() === "" ? 0 : Number(values.displayOrder),
  };
}

export function getZoneDeleteConfirmationMessage(zone: ParkingZone): string {
  return `This will remove ${zone.name} and any parking spots linked to it.`;
}

export function createEmptySpotFormValues(defaultZoneId = ""): SpotFormValues {
  return {
    zoneId: defaultZoneId,
    spotCode: "",
    status: "available",
    level: "",
    rowLabel: "",
  };
}

export function createSpotFormValues(spot: ParkingSpot): SpotFormValues {
  return {
    zoneId: spot.zoneId,
    spotCode: spot.spotCode,
    status: spot.status,
    level: spot.level ?? "",
    rowLabel: spot.rowLabel ?? "",
  };
}

export function validateSpotForm(
  values: SpotFormValues,
  zones: Pick<ParkingZone, "id">[],
): SpotFormErrors {
  const errors: SpotFormErrors = {};

  if (!zones.some((zone) => zone.id === values.zoneId)) {
    errors.zoneId = "Choose an existing zone";
  }

  if (values.spotCode.trim() === "") {
    errors.spotCode = "Spot code is required";
  }

  if (!isParkingSpotStatus(values.status)) {
    errors.status = "Choose a valid status";
  }

  return errors;
}

export function spotFormHasErrors(errors: SpotFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function toParkingSpotRequest(values: SpotFormValues): ParkingSpotRequest {
  return {
    zoneId: values.zoneId,
    spotCode: values.spotCode.trim(),
    status: isParkingSpotStatus(values.status) ? values.status : undefined,
    level: values.level.trim() || null,
    rowLabel: values.rowLabel.trim() || null,
  };
}

export function getSpotDeleteConfirmationMessage(spot: ParkingSpot): string {
  return `This will remove parking spot ${spot.spotCode}.`;
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
  const [message, setMessage] = useState<string | null>(null);
  const [zoneFormMode, setZoneFormMode] = useState<ZoneFormMode>("create");
  const [selectedZone, setSelectedZone] = useState<ParkingZone | null>(null);
  const [zoneFormValues, setZoneFormValues] = useState<ZoneFormValues>(
    createEmptyZoneFormValues(),
  );
  const [zoneFormErrors, setZoneFormErrors] = useState<ZoneFormErrors>({});
  const [pendingDeleteZone, setPendingDeleteZone] = useState<ParkingZone | null>(null);
  const [spotFormMode, setSpotFormMode] = useState<SpotFormMode>("create");
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [spotFormValues, setSpotFormValues] = useState<SpotFormValues>(
    createEmptySpotFormValues(),
  );
  const [spotFormErrors, setSpotFormErrors] = useState<SpotFormErrors>({});
  const [pendingDeleteSpot, setPendingDeleteSpot] = useState<ParkingSpot | null>(null);
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
      const [zonesResult, spotsResult, occupancyResult] = await Promise.allSettled([
        parkingZonesApi.listZones(),
        parkingSpotsApi.listSpots(),
        occupancyApi.getSummary(),
      ]);
      if (zonesResult.status === "rejected") {
        throw zonesResult.reason;
      }

      if (spotsResult.status === "rejected") {
        throw spotsResult.reason;
      }

      const occupancySummary =
        occupancyResult.status === "fulfilled" ? occupancyResult.value.summary : null;
      const nextInventory = {
        zones: mergeZonesWithOccupancy(
          zonesResult.value.parkingZones,
          occupancySummary,
        ),
        spots: spotsResult.value.parkingSpots,
        summary: occupancySummary,
      };

      setInventory(nextInventory);
      setStatus(hasParkingInventory(nextInventory) ? "ready" : "empty");
      setError(
        occupancyResult.status === "rejected"
          ? getOptionalOccupancyWarningMessage(occupancyResult.reason)
          : null,
      );
    } catch (loadError) {
      setStatus("error");
      setError(getParkingInventoryErrorMessage(loadError));
    }
  }, [occupancyApi, parkingSpotsApi, parkingZonesApi, user]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if (
      spotFormMode === "create" &&
      spotFormValues.zoneId === "" &&
      inventory.zones.length > 0
    ) {
      setSpotFormValues((currentValues) => ({
        ...currentValues,
        zoneId: inventory.zones[0].id,
      }));
    }
  }, [inventory.zones, spotFormMode, spotFormValues.zoneId]);

  function startCreateZone() {
    setActiveView("zones");
    setZoneFormMode("create");
    setSelectedZone(null);
    setZoneFormValues(createEmptyZoneFormValues());
    setZoneFormErrors({});
    setPendingDeleteZone(null);
    setPendingDeleteSpot(null);
    setMessage(null);
    setError(null);
  }

  function startEditZone(zone: ParkingZone) {
    setActiveView("zones");
    setZoneFormMode("edit");
    setSelectedZone(zone);
    setZoneFormValues(createZoneFormValues(zone));
    setZoneFormErrors({});
    setPendingDeleteZone(null);
    setPendingDeleteSpot(null);
    setMessage(null);
    setError(null);
  }

  function startCreateSpot() {
    setActiveView("spots");
    setSpotFormMode("create");
    setSelectedSpot(null);
    setSpotFormValues(createEmptySpotFormValues(inventory.zones[0]?.id ?? ""));
    setSpotFormErrors({});
    setPendingDeleteSpot(null);
    setPendingDeleteZone(null);
    setMessage(null);
    setError(null);
  }

  function startEditSpot(spot: ParkingSpot) {
    setActiveView("spots");
    setSpotFormMode("edit");
    setSelectedSpot(spot);
    setSpotFormValues(createSpotFormValues(spot));
    setSpotFormErrors({});
    setPendingDeleteSpot(null);
    setPendingDeleteZone(null);
    setMessage(null);
    setError(null);
  }

  async function submitZoneForm() {
    const nextErrors = validateZoneForm(zoneFormValues);

    setZoneFormErrors(nextErrors);
    setMessage(null);
    setError(null);

    if (zoneFormHasErrors(nextErrors)) {
      return;
    }

    try {
      if (zoneFormMode === "edit" && selectedZone) {
        await parkingZonesApi.updateZone(selectedZone.id, toParkingZoneRequest(zoneFormValues));
        setMessage("Parking zone updated.");
      } else {
        await parkingZonesApi.createZone(toParkingZoneRequest(zoneFormValues));
        setMessage("Parking zone created.");
      }

      setZoneFormMode("create");
      setSelectedZone(null);
      setZoneFormValues(createEmptyZoneFormValues());
      setZoneFormErrors({});
      await loadInventory();
    } catch (submitError) {
      setError(getParkingInventoryErrorMessage(submitError));
    }
  }

  async function confirmDeleteZone() {
    if (!pendingDeleteZone) {
      return;
    }

    setMessage(null);
    setError(null);

    try {
      await parkingZonesApi.deleteZone(pendingDeleteZone.id);
      setMessage("Parking zone deleted.");
      setPendingDeleteZone(null);

      if (selectedZone?.id === pendingDeleteZone.id) {
        setZoneFormMode("create");
        setSelectedZone(null);
        setZoneFormValues(createEmptyZoneFormValues());
      }

      await loadInventory();
    } catch (deleteError) {
      setError(getParkingInventoryErrorMessage(deleteError));
    }
  }

  async function submitSpotForm() {
    const nextErrors = validateSpotForm(spotFormValues, inventory.zones);

    setSpotFormErrors(nextErrors);
    setMessage(null);
    setError(null);

    if (spotFormHasErrors(nextErrors)) {
      return;
    }

    try {
      if (spotFormMode === "edit" && selectedSpot) {
        await parkingSpotsApi.updateSpot(selectedSpot.id, toParkingSpotRequest(spotFormValues));
        setMessage("Parking spot updated.");
      } else {
        await parkingSpotsApi.createSpot(toParkingSpotRequest(spotFormValues));
        setMessage("Parking spot created.");
      }

      setSpotFormMode("create");
      setSelectedSpot(null);
      setSpotFormValues(createEmptySpotFormValues(spotFormValues.zoneId));
      setSpotFormErrors({});
      await loadInventory();
    } catch (submitError) {
      setError(getParkingInventoryErrorMessage(submitError));
    }
  }

  async function confirmDeleteSpot() {
    if (!pendingDeleteSpot) {
      return;
    }

    setMessage(null);
    setError(null);

    try {
      await parkingSpotsApi.deleteSpot(pendingDeleteSpot.id);
      setMessage("Parking spot deleted.");
      setPendingDeleteSpot(null);

      if (selectedSpot?.id === pendingDeleteSpot.id) {
        setSpotFormMode("create");
        setSelectedSpot(null);
        setSpotFormValues(createEmptySpotFormValues(inventory.zones[0]?.id ?? ""));
      }

      await loadInventory();
    } catch (deleteError) {
      setError(getParkingInventoryErrorMessage(deleteError));
    }
  }

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

      {message ? <p className="form-success inventory-feedback">{message}</p> : null}
      {error ? <p className="form-banner-error inventory-feedback">{error}</p> : null}
      {pendingDeleteZone ? (
        <section className="admin-confirmation inventory-confirmation" aria-live="polite">
          <div>
            <p className="eyebrow">Confirm delete</p>
            <h3>{pendingDeleteZone.name}</h3>
            <p>{getZoneDeleteConfirmationMessage(pendingDeleteZone)}</p>
          </div>
          <div className="admin-confirmation-actions">
            <button
              className="danger-button"
              onClick={() => void confirmDeleteZone()}
              type="button"
            >
              Confirm delete
            </button>
            <button
              className="secondary-button"
              onClick={() => setPendingDeleteZone(null)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}
      {pendingDeleteSpot ? (
        <section className="admin-confirmation inventory-confirmation" aria-live="polite">
          <div>
            <p className="eyebrow">Confirm delete</p>
            <h3>{pendingDeleteSpot.spotCode}</h3>
            <p>{getSpotDeleteConfirmationMessage(pendingDeleteSpot)}</p>
          </div>
          <div className="admin-confirmation-actions">
            <button
              className="danger-button"
              onClick={() => void confirmDeleteSpot()}
              type="button"
            >
              Confirm delete
            </button>
            <button
              className="secondary-button"
              onClick={() => setPendingDeleteSpot(null)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {activeView === "zones" ? (
        <div className="inventory-management-grid">
          <ParkingZonesTable
            zones={inventory.zones}
            onCreate={startCreateZone}
            onDelete={(zone) => {
              setPendingDeleteZone(zone);
              setMessage(null);
              setError(null);
            }}
            onEdit={startEditZone}
          />
          <ZoneEditorPanel
            errors={zoneFormErrors}
            mode={zoneFormMode}
            onCancel={startCreateZone}
            onChange={(field, value) =>
              setZoneFormValues((currentValues) => ({
                ...currentValues,
                [field]: value,
              }))
            }
            onSubmit={() => void submitZoneForm()}
            selectedZone={selectedZone}
            values={zoneFormValues}
          />
        </div>
      ) : (
        <div className="inventory-management-grid">
          <ParkingSpotsTable
            onCreate={startCreateSpot}
            onDelete={(spot) => {
              setPendingDeleteSpot(spot);
              setPendingDeleteZone(null);
              setMessage(null);
              setError(null);
            }}
            onEdit={startEditSpot}
            spots={inventory.spots}
            zones={inventory.zones}
          />
          <SpotEditorPanel
            errors={spotFormErrors}
            mode={spotFormMode}
            onCancel={startCreateSpot}
            onChange={(field, value) =>
              setSpotFormValues((currentValues) => ({
                ...currentValues,
                [field]: value,
              }))
            }
            onSubmit={() => void submitSpotForm()}
            selectedSpot={selectedSpot}
            values={spotFormValues}
            zones={inventory.zones}
          />
        </div>
      )}
    </section>
  );
}

function ParkingZonesTable({
  onCreate,
  onDelete,
  onEdit,
  zones,
}: {
  onCreate: () => void;
  onDelete: (zone: ParkingZone) => void;
  onEdit: (zone: ParkingZone) => void;
  zones: Array<ParkingZone & Partial<ZoneOccupancySummary>>;
}) {
  return (
    <div className="inventory-table-card inventory-table-card-wide" role="table" aria-label="Parking zones">
      <div className="inventory-table-title inventory-table-title-actions">
        <span>Parking Zones</span>
        <button className="secondary-button compact-button" onClick={onCreate} type="button">
          Add Zone
        </button>
      </div>
      <div className="inventory-row inventory-row-heading" role="row">
        <span role="columnheader">Zone</span>
        <span role="columnheader">Capacity</span>
        <span role="columnheader">Available</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Action</span>
      </div>
      {zones.length === 0 ? (
        <section className="inventory-empty-inline">
          <h3>No parking zones yet</h3>
          <p>Create the first zone to start organising campus parking capacity.</p>
        </section>
      ) : null}
      {zones.map((zone) => {
        const status = getZoneOperationalStatus(zone);

        return (
          <div className="inventory-row" key={zone.id} role="row">
            <span role="cell">
              <strong>{zone.name}</strong>
              {zone.description ? <small>{zone.description}</small> : null}
            </span>
            <span role="cell">{zone.capacity}</span>
            <span role="cell">{getZoneAvailableSpotText(zone)}</span>
            <span role="cell">{status}</span>
            <span className="inventory-row-actions" role="cell">
              <button className="text-button" onClick={() => onEdit(zone)} type="button">
                Edit
              </button>
              <button className="text-button text-button-danger" onClick={() => onDelete(zone)} type="button">
                Delete
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ZoneEditorPanel({
  errors,
  mode,
  onCancel,
  onChange,
  onSubmit,
  selectedZone,
  values,
}: {
  errors: ZoneFormErrors;
  mode: ZoneFormMode;
  onCancel: () => void;
  onChange: (field: keyof ZoneFormValues, value: string) => void;
  onSubmit: () => void;
  selectedZone: ParkingZone | null;
  values: ZoneFormValues;
}) {
  return (
    <section className="zone-editor-panel" aria-labelledby="zone-editor-title">
      <h3 id="zone-editor-title">
        {mode === "edit" ? "Edit Parking Zone" : "Create Parking Zone"}
      </h3>
      <TextField
        error={errors.name}
        label="Zone Name"
        name="zoneName"
        onChange={(event) => onChange("name", event.target.value)}
        placeholder="Zone D"
        value={values.name}
      />
      <TextField
        error={errors.capacity}
        inputMode="numeric"
        label="Capacity"
        name="capacity"
        onChange={(event) => onChange("capacity", event.target.value)}
        placeholder="80"
        value={values.capacity}
      />
      <TextField
        label="Description"
        name="description"
        onChange={(event) => onChange("description", event.target.value)}
        placeholder="North campus parking"
        value={values.description}
      />
      <TextField
        error={errors.distanceFromEntryMeters}
        inputMode="numeric"
        label="Distance"
        name="distanceFromEntryMeters"
        onChange={(event) => onChange("distanceFromEntryMeters", event.target.value)}
        placeholder="120"
        value={values.distanceFromEntryMeters}
      />
      <div className="zone-editor-actions">
        <button className="primary-button" onClick={onSubmit} type="button">
          {mode === "edit" ? "Save Zone" : "Create Zone"}
        </button>
        {mode === "edit" && selectedZone ? (
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ParkingSpotsTable({
  onCreate,
  onDelete,
  onEdit,
  spots,
  zones,
}: {
  onCreate: () => void;
  onDelete: (spot: ParkingSpot) => void;
  onEdit: (spot: ParkingSpot) => void;
  spots: ParkingSpot[];
  zones: Array<ParkingZone & Partial<ZoneOccupancySummary>>;
}) {
  const zoneNameById = new Map(zones.map((zone) => [zone.id, zone.name]));

  return (
    <div className="inventory-table-card inventory-table-card-wide" role="table" aria-label="Parking spots">
      <div className="inventory-table-title inventory-table-title-actions">
        <span>Parking Spots</span>
        <button className="secondary-button compact-button" onClick={onCreate} type="button">
          Add Spot
        </button>
      </div>
      <div className="inventory-row inventory-row-heading inventory-row-spots" role="row">
        <span role="columnheader">Spot</span>
        <span role="columnheader">Zone</span>
        <span role="columnheader">Level</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Action</span>
      </div>
      {spots.length === 0 ? (
        <section className="inventory-empty-inline">
          <h3>No parking spots yet</h3>
          <p>Create a spot after adding at least one parking zone.</p>
        </section>
      ) : null}
      {spots.map((spot) => (
        <div className="inventory-row inventory-row-spots" key={spot.id} role="row">
          <span role="cell">
            <strong>{spot.spotCode}</strong>
            <small>{spot.rowLabel ? `Row ${spot.rowLabel}` : "Row not set"}</small>
          </span>
          <span role="cell">{zoneNameById.get(spot.zoneId) ?? spot.zoneId}</span>
          <span role="cell">{spot.level ?? "Standard"}</span>
          <span role="cell">
            <span className={getParkingSpotStatusClass(spot.status)}>
              {getParkingSpotStatusText(spot.status)}
            </span>
          </span>
          <span className="inventory-row-actions" role="cell">
            <button className="text-button" onClick={() => onEdit(spot)} type="button">
              Edit
            </button>
            <button className="text-button text-button-danger" onClick={() => onDelete(spot)} type="button">
              Delete
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function SpotEditorPanel({
  errors,
  mode,
  onCancel,
  onChange,
  onSubmit,
  selectedSpot,
  values,
  zones,
}: {
  errors: SpotFormErrors;
  mode: SpotFormMode;
  onCancel: () => void;
  onChange: (field: keyof SpotFormValues, value: string) => void;
  onSubmit: () => void;
  selectedSpot: ParkingSpot | null;
  values: SpotFormValues;
  zones: Array<ParkingZone & Partial<ZoneOccupancySummary>>;
}) {
  return (
    <section className="zone-editor-panel spot-editor-panel" aria-labelledby="spot-editor-title">
      <h3 id="spot-editor-title">
        {mode === "edit" && selectedSpot
          ? `Update Spot ${selectedSpot.spotCode}`
          : "Create Parking Spot"}
      </h3>
      {selectedSpot ? (
        <span className={getParkingSpotStatusClass(selectedSpot.status)}>
          {getParkingSpotStatusText(selectedSpot.status)}
        </span>
      ) : null}
      <SelectField
        error={errors.zoneId}
        label="Zone"
        name="spotZone"
        onChange={(value) => onChange("zoneId", value)}
        value={values.zoneId}
      >
        <option value="">Choose zone</option>
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.name}
          </option>
        ))}
      </SelectField>
      <TextField
        error={errors.spotCode}
        label="Spot Code"
        name="spotCode"
        onChange={(event) => onChange("spotCode", event.target.value)}
        placeholder="D-12"
        value={values.spotCode}
      />
      <SelectField
        error={errors.status}
        label="Status"
        name="spotStatus"
        onChange={(value) => onChange("status", value)}
        value={values.status}
      >
        {PARKING_SPOT_STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {getParkingSpotStatusText(status)}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Level"
        name="spotLevel"
        onChange={(event) => onChange("level", event.target.value)}
        placeholder="Ground"
        value={values.level}
      />
      <TextField
        label="Row Label"
        name="spotRowLabel"
        onChange={(event) => onChange("rowLabel", event.target.value)}
        placeholder="D"
        value={values.rowLabel}
      />
      <div className="zone-editor-actions">
        <button
          className="primary-button"
          disabled={zones.length === 0}
          onClick={onSubmit}
          type="button"
        >
          {mode === "edit" ? "Save Spot" : "Create Spot"}
        </button>
        {mode === "edit" && selectedSpot ? (
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}

function SelectField({
  children,
  error,
  label,
  name,
  onChange,
  value,
}: {
  children: ReactNode;
  error?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const errorId = `${name}-error`;

  return (
    <label className={error ? "form-field form-field-error" : "form-field"} htmlFor={name}>
      <span className="form-label">{label}</span>
      <select
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        id={name}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
      {error ? (
        <span className="form-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
