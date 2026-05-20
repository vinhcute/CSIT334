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
  type ParkingSpotsPagination,
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
const SPOT_PAGE_SIZE = 20;

export type AdminParkingInventoryView = "zones" | "spots";
type InventoryStatus = "loading" | "ready" | "empty" | "error";
type ZoneFormMode = "create" | "edit";
type SpotFormMode = "create" | "edit";
export type SpotPanelMode = "none" | "createSpot" | "bulkLevel";

export const PARKING_SPOT_STATUS_OPTIONS: ParkingSpotStatus[] = [
  "available",
  "occupied",
  "reserved",
  "maintenanceRequired",
];

export interface ZoneFormValues {
  zoneCode: string;
  name: string;
  capacity: string;
  description: string;
  distanceFromEntryMeters: string;
  displayOrder: string;
  defaultSpotLevel: string;
}

export interface ZoneFormErrors {
  zoneCode?: string;
  name?: string;
  capacity?: string;
  distanceFromEntryMeters?: string;
  displayOrder?: string;
}

export interface BulkLevelFormValues {
  zoneId: string;
  level: string;
  targetMode: "all" | "range";
  rangeFrom: string;
  rangeTo: string;
}

export interface BulkLevelFormErrors {
  zoneId?: string;
  level?: string;
  rangeFrom?: string;
  rangeTo?: string;
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
  spotPagination: ParkingSpotsPagination;
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
    zoneCode: "",
    name: "",
    capacity: "",
    description: "",
    distanceFromEntryMeters: "",
    displayOrder: "",
    defaultSpotLevel: "",
  };
}

export function createZoneFormValues(zone: ParkingZone): ZoneFormValues {
  return {
    zoneCode: zone.zoneCode,
    name: zone.name,
    capacity: String(zone.capacity),
    description: zone.description ?? "",
    distanceFromEntryMeters:
      zone.distanceFromEntryMeters === null ? "" : String(zone.distanceFromEntryMeters),
    displayOrder: String(zone.displayOrder),
    defaultSpotLevel: "",
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
  const normalizedZoneCode = values.zoneCode.trim().toUpperCase();

  if (normalizedZoneCode === "") {
    errors.zoneCode = "Zone ID is required";
  } else if (!/^[A-Z]{1,4}$/.test(normalizedZoneCode)) {
    errors.zoneCode = "Zone ID must use 1 to 4 uppercase letters";
  }

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
  const defaultSpotLevel = values.defaultSpotLevel.trim();

  return {
    zoneCode: values.zoneCode.trim().toUpperCase(),
    name: values.name.trim(),
    capacity: Number(values.capacity),
    description: values.description.trim() || null,
    distanceFromEntryMeters:
      values.distanceFromEntryMeters.trim() === ""
        ? null
        : Number(values.distanceFromEntryMeters),
    displayOrder: values.displayOrder.trim() === "" ? 0 : Number(values.displayOrder),
    defaultSpotLevel: defaultSpotLevel || undefined,
  };
}

export function createBulkLevelFormValues(defaultZoneId = ""): BulkLevelFormValues {
  return {
    zoneId: defaultZoneId,
    level: "",
    targetMode: "all",
    rangeFrom: "",
    rangeTo: "",
  };
}

export function createDefaultSpotPanelMode(): SpotPanelMode {
  return "none";
}

export function shouldShowSpotEditorPanel(mode: SpotPanelMode): boolean {
  return mode === "createSpot";
}

export function shouldShowBulkLevelPanel(mode: SpotPanelMode): boolean {
  return mode === "bulkLevel";
}

export function validateBulkLevelForm(
  values: BulkLevelFormValues,
  zones: Pick<ParkingZone, "id">[],
): BulkLevelFormErrors {
  const errors: BulkLevelFormErrors = {};

  if (!zones.some((zone) => zone.id === values.zoneId)) {
    errors.zoneId = "Choose an existing zone";
  }

  if (values.level.trim() === "") {
    errors.level = "Level is required";
  }

  if (values.targetMode === "range") {
    const from = Number(values.rangeFrom);
    const to = Number(values.rangeTo);

    if (values.rangeFrom.trim() === "") {
      errors.rangeFrom = "From number is required";
    } else if (!Number.isInteger(from) || from < 1) {
      errors.rangeFrom = "From number must be a whole number from 1";
    }

    if (values.rangeTo.trim() === "") {
      errors.rangeTo = "To number is required";
    } else if (!Number.isInteger(to) || to < 1) {
      errors.rangeTo = "To number must be a whole number from 1";
    }

    if (
      errors.rangeFrom === undefined &&
      errors.rangeTo === undefined &&
      from > to
    ) {
      errors.rangeTo = "To number must be greater than or equal to from number";
    }
  }

  return errors;
}

export function bulkLevelFormHasErrors(errors: BulkLevelFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function getBulkLevelRangePreview(
  values: BulkLevelFormValues,
  zones: Pick<ParkingZone, "id" | "zoneCode">[],
): string | null {
  if (values.targetMode !== "range") {
    return null;
  }

  const zone = zones.find((candidate) => candidate.id === values.zoneId);
  const from = Number(values.rangeFrom);
  const to = Number(values.rangeTo);

  if (!zone || !Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return null;
  }

  return `Will update ${zone.zoneCode}-${String(from).padStart(3, "0")} to ${zone.zoneCode}-${String(to).padStart(3, "0")}`;
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
    spotCode: values.spotCode.trim() || undefined,
    status: isParkingSpotStatus(values.status) ? values.status : undefined,
    level: values.level.trim() || null,
    rowLabel: values.rowLabel.trim() || null,
  };
}

export function getGeneratedSpotCodePreviewText(spotCode: string): string {
  return spotCode.trim() || "Generated when created";
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
  const [activeSpotPanel, setActiveSpotPanel] = useState<SpotPanelMode>(
    createDefaultSpotPanelMode(),
  );
  const [pendingDeleteSpot, setPendingDeleteSpot] = useState<ParkingSpot | null>(null);
  const [bulkLevelValues, setBulkLevelValues] = useState<BulkLevelFormValues>(
    createBulkLevelFormValues(),
  );
  const [bulkLevelErrors, setBulkLevelErrors] = useState<BulkLevelFormErrors>({});
  const [isBulkUpdatingLevel, setIsBulkUpdatingLevel] = useState(false);
  const [spotPage, setSpotPage] = useState(1);
  const [inventory, setInventory] = useState<ParkingInventoryViewModel>({
    zones: [],
    spots: [],
    spotPagination: {
      page: 1,
      pageSize: SPOT_PAGE_SIZE,
      total: 0,
      totalPages: 1,
    },
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
        parkingSpotsApi.listSpots({ page: spotPage, pageSize: SPOT_PAGE_SIZE }),
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
        spotPagination: spotsResult.value.pagination ?? {
          page: spotPage,
          pageSize: SPOT_PAGE_SIZE,
          total: spotsResult.value.parkingSpots.length,
          totalPages: 1,
        },
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
  }, [occupancyApi, parkingSpotsApi, parkingZonesApi, spotPage, user]);

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

  useEffect(() => {
    if (bulkLevelValues.zoneId === "" && inventory.zones.length > 0) {
      setBulkLevelValues((currentValues) => ({
        ...currentValues,
        zoneId: inventory.zones[0].id,
      }));
    }
  }, [bulkLevelValues.zoneId, inventory.zones]);

  useEffect(() => {
    if (spotFormMode !== "create" || spotFormValues.zoneId === "") {
      return;
    }

    let isCurrent = true;

    async function loadNextSpotCode() {
      try {
        const result = await parkingSpotsApi.getNextSpotCode(spotFormValues.zoneId);

        if (isCurrent) {
          setSpotFormValues((currentValues) => ({
            ...currentValues,
            spotCode: result.spotCode,
          }));
        }
      } catch {
        if (isCurrent) {
          setSpotFormValues((currentValues) => ({
            ...currentValues,
            spotCode: "",
          }));
        }
      }
    }

    void loadNextSpotCode();

    return () => {
      isCurrent = false;
    };
  }, [parkingSpotsApi, spotFormMode, spotFormValues.zoneId]);

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
    setSpotPage(1);
    setActiveSpotPanel("createSpot");
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
    setActiveSpotPanel("createSpot");
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
      setActiveSpotPanel("none");
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
        setActiveSpotPanel("none");
      }

      await loadInventory();
    } catch (deleteError) {
      setError(getParkingInventoryErrorMessage(deleteError));
    }
  }

  async function submitBulkLevelUpdate() {
    const nextErrors = validateBulkLevelForm(bulkLevelValues, inventory.zones);

    setBulkLevelErrors(nextErrors);
    setMessage(null);
    setError(null);

    if (bulkLevelFormHasErrors(nextErrors)) {
      return;
    }

    try {
      setIsBulkUpdatingLevel(true);
      const result = await parkingSpotsApi.bulkUpdateLevel({
        zoneId: bulkLevelValues.zoneId,
        level: bulkLevelValues.level,
        ...(bulkLevelValues.targetMode === "range"
          ? {
              range: {
                from: Number(bulkLevelValues.rangeFrom),
                to: Number(bulkLevelValues.rangeTo),
              },
            }
          : {}),
      });
      setMessage(`Updated ${result.updatedCount} parking spots to ${result.level}.`);
      await loadInventory();
      setActiveSpotPanel("none");
    } catch (bulkUpdateError) {
      setError(getParkingInventoryErrorMessage(bulkUpdateError));
    } finally {
      setIsBulkUpdatingLevel(false);
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
            onOpenBulkLevel={() => {
              setActiveSpotPanel("bulkLevel");
              setSpotFormMode("create");
              setSelectedSpot(null);
              setSpotFormValues(createEmptySpotFormValues(inventory.zones[0]?.id ?? ""));
              setSpotFormErrors({});
              setMessage(null);
              setError(null);
            }}
            onDelete={(spot) => {
              setPendingDeleteSpot(spot);
              setPendingDeleteZone(null);
              setMessage(null);
              setError(null);
            }}
            onEdit={startEditSpot}
            spots={inventory.spots}
            pagination={inventory.spotPagination}
            onNextPage={() =>
              setSpotPage((currentPage) =>
                Math.min(currentPage + 1, inventory.spotPagination.totalPages),
              )
            }
            onPreviousPage={() =>
              setSpotPage((currentPage) => Math.max(currentPage - 1, 1))
            }
            zones={inventory.zones}
          />
          {shouldShowBulkLevelPanel(activeSpotPanel) ? (
            <BulkLevelPanel
              errors={bulkLevelErrors}
              isSubmitting={isBulkUpdatingLevel}
              onCancel={() => setActiveSpotPanel("none")}
              onChange={(field, value) =>
                setBulkLevelValues((currentValues) => ({
                  ...currentValues,
                  [field]: value,
                }))
              }
              onSubmit={() => void submitBulkLevelUpdate()}
              values={bulkLevelValues}
              zones={inventory.zones}
            />
          ) : null}
          {shouldShowSpotEditorPanel(activeSpotPanel) ? (
            <SpotEditorPanel
              errors={spotFormErrors}
              mode={spotFormMode}
              onCancel={() => {
                setSpotFormMode("create");
                setSelectedSpot(null);
                setSpotFormValues(createEmptySpotFormValues(inventory.zones[0]?.id ?? ""));
                setSpotFormErrors({});
                setActiveSpotPanel("none");
              }}
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
          ) : null}
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
        <span role="columnheader">Zone ID</span>
        <span role="columnheader">Zone Name</span>
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
              <strong>{zone.zoneCode}</strong>
            </span>
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
        error={errors.zoneCode}
        label="Zone ID"
        name="zoneCode"
        onChange={(event) => onChange("zoneCode", event.target.value)}
        placeholder="D"
        value={values.zoneCode}
      />
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
      <SelectField
        label="Default spot level"
        name="defaultSpotLevel"
        onChange={(value) => onChange("defaultSpotLevel", value)}
        value={values.defaultSpotLevel}
      >
        <option value="">No default (Standard)</option>
        <option value="Ground">Ground</option>
        <option value="Level 1">Level 1</option>
        <option value="Level 2">Level 2</option>
        <option value="Basement">Basement</option>
        <option value="Outdoor">Outdoor</option>
      </SelectField>
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
  onNextPage,
  onCreate,
  onOpenBulkLevel,
  onDelete,
  onEdit,
  onPreviousPage,
  pagination,
  spots,
  zones,
}: {
  onNextPage: () => void;
  onCreate: () => void;
  onOpenBulkLevel: () => void;
  onDelete: (spot: ParkingSpot) => void;
  onEdit: (spot: ParkingSpot) => void;
  onPreviousPage: () => void;
  pagination: ParkingSpotsPagination;
  spots: ParkingSpot[];
  zones: Array<ParkingZone & Partial<ZoneOccupancySummary>>;
}) {
  const zoneNameById = new Map(zones.map((zone) => [zone.id, zone.name]));

  return (
    <div className="inventory-table-card inventory-table-card-wide" role="table" aria-label="Parking spots">
      <div className="inventory-table-title inventory-table-title-actions">
        <span>Parking Spots</span>
        <div className="inventory-table-actions">
          <button className="secondary-button compact-button" onClick={onOpenBulkLevel} type="button">
            Bulk Level Update
          </button>
          <button className="secondary-button compact-button" onClick={onCreate} type="button">
            Add Spot
          </button>
        </div>
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
      <div className="inventory-pagination" aria-label="Parking spot pagination">
        <button
          className="secondary-button compact-button"
          disabled={pagination.page <= 1}
          onClick={onPreviousPage}
          type="button"
        >
          Previous
        </button>
        <span>
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <button
          className="secondary-button compact-button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={onNextPage}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function BulkLevelPanel({
  errors,
  isSubmitting,
  onCancel,
  onChange,
  onSubmit,
  values,
  zones,
}: {
  errors: BulkLevelFormErrors;
  isSubmitting: boolean;
  onCancel: () => void;
  onChange: (field: keyof BulkLevelFormValues, value: string) => void;
  onSubmit: () => void;
  values: BulkLevelFormValues;
  zones: Array<ParkingZone & Partial<ZoneOccupancySummary>>;
}) {
  const rangePreview = getBulkLevelRangePreview(values, zones);

  return (
    <section className="zone-editor-panel" aria-labelledby="bulk-level-title">
      <h3 id="bulk-level-title">Bulk Spot Level Update</h3>
      <p className="selected-spot-copy">
        Apply a level to every parking spot in the selected zone.
      </p>
      <fieldset className="bulk-target-group" aria-label="Apply to">
        <legend className="form-label">Apply to</legend>
        <label className="bulk-target-option">
          <input
            checked={values.targetMode === "all"}
            name="bulkTargetMode"
            onChange={() => onChange("targetMode", "all")}
            type="radio"
            value="all"
          />
          <span>All spots in this zone</span>
        </label>
        <label className="bulk-target-option">
          <input
            checked={values.targetMode === "range"}
            name="bulkTargetMode"
            onChange={() => onChange("targetMode", "range")}
            type="radio"
            value="range"
          />
          <span>Spot number range</span>
        </label>
      </fieldset>
      <SelectField
        error={errors.zoneId}
        label="Zone"
        name="bulkZone"
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
      <SelectField
        error={errors.level}
        label="Level"
        name="bulkLevel"
        onChange={(value) => onChange("level", value)}
        value={values.level}
      >
        <option value="">Choose level</option>
        <option value="Ground">Ground</option>
        <option value="Level 1">Level 1</option>
        <option value="Level 2">Level 2</option>
        <option value="Basement">Basement</option>
        <option value="Outdoor">Outdoor</option>
      </SelectField>
      {values.targetMode === "range" ? (
        <>
          <TextField
            error={errors.rangeFrom}
            inputMode="numeric"
            label="From number"
            name="bulkRangeFrom"
            onChange={(event) => onChange("rangeFrom", event.target.value)}
            placeholder="1"
            value={values.rangeFrom}
          />
          <TextField
            error={errors.rangeTo}
            inputMode="numeric"
            label="To number"
            name="bulkRangeTo"
            onChange={(event) => onChange("rangeTo", event.target.value)}
            placeholder="10"
            value={values.rangeTo}
          />
          {rangePreview ? <p className="bulk-range-preview">{rangePreview}</p> : null}
        </>
      ) : null}
      <div className="zone-editor-actions">
        <button
          className="primary-button"
          disabled={isSubmitting || zones.length === 0}
          onClick={onSubmit}
          type="button"
        >
          {isSubmitting ? "Applying..." : "Apply Level"}
        </button>
        <button className="secondary-button" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </section>
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
        placeholder="Generated when created"
        readOnly={mode === "create"}
        value={
          mode === "create"
            ? getGeneratedSpotCodePreviewText(values.spotCode)
            : values.spotCode
        }
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
        ) : (
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
        )}
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
