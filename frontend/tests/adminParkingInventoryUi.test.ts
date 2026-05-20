import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";
import type { OccupancySummary } from "../src/services/occupancyApi.js";
import {
  AdminParkingInventoryPage,
  bulkLevelFormHasErrors,
  canViewAdminParkingInventory,
  createDefaultSpotPanelMode,
  createBulkLevelFormValues,
  createEmptySpotFormValues,
  createEmptyZoneFormValues,
  createSpotFormValues,
  getBulkLevelRangePreview,
  getOptionalOccupancyWarningMessage,
  getParkingInventoryErrorMessage,
  getParkingSpotStatusClass,
  getParkingSpotStatusText,
  getZoneAvailableSpotText,
  getZoneOperationalStatus,
  hasParkingInventory,
  mergeZonesWithOccupancy,
  shouldShowBulkLevelPanel,
  shouldShowSpotEditorPanel,
  toParkingZoneRequest,
  toParkingSpotRequest,
  validateBulkLevelForm,
  type ParkingInventoryViewModel,
  type SpotPanelMode,
} from "../src/features/admin/AdminParkingInventoryPage.js";
import type { SafeUser } from "../src/features/auth/authTypes.js";
import type { ParkingSpot } from "../src/services/parkingSpotsApi.js";
import type { ParkingZone } from "../src/services/parkingZonesApi.js";

const defaultSpotPagination = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
};

const adminUser: SafeUser = {
  id: "admin-1",
  email: "admin@example.test",
  role: "admin",
  accountStatus: "active",
};

const driverUser: SafeUser = {
  id: "driver-1",
  email: "driver@example.test",
  role: "driver",
  accountStatus: "active",
};

describe("admin parking inventory UI shell", () => {
  it("only allows administrators to view parking inventory", () => {
    expect(canViewAdminParkingInventory(adminUser)).toBe(true);
    expect(canViewAdminParkingInventory(driverUser)).toBe(false);
    expect(canViewAdminParkingInventory(null)).toBe(false);
  });

  it("exports a shell that can open on the zones or spots view", () => {
    const zonesElement = createElement(AdminParkingInventoryPage, {
      initialView: "zones",
    });
    const spotsElement = createElement(AdminParkingInventoryPage, {
      initialView: "spots",
    });

    expect(zonesElement.type).toBe(AdminParkingInventoryPage);
    expect(spotsElement.props.initialView).toBe("spots");
  });

  it("detects empty and ready inventory states from loaded data", () => {
    const emptyInventory: ParkingInventoryViewModel = {
      zones: [],
      spots: [],
      spotPagination: defaultSpotPagination,
      summary: null,
    };
    const readyInventory: ParkingInventoryViewModel = {
      zones: [
        {
          id: "zone-1",
          zoneCode: "A",
          name: "Zone A",
          description: null,
          capacity: 10,
          distanceFromEntryMeters: null,
          displayOrder: 1,
          createdAt: "2026-05-15T00:00:00.000Z",
          updatedAt: "2026-05-15T00:00:00.000Z",
        },
      ],
      spots: [],
      spotPagination: defaultSpotPagination,
      summary: null,
    };

    expect(hasParkingInventory(emptyInventory)).toBe(false);
    expect(hasParkingInventory(readyInventory)).toBe(true);
  });

  it("merges zone metadata with occupancy counts for the read-only table", () => {
    const zones: ParkingZone[] = [
      {
        id: "zone-1",
        zoneCode: "A",
        name: "Zone A",
        description: "North parking",
        capacity: 10,
        distanceFromEntryMeters: 120,
        displayOrder: 1,
        createdAt: "2026-05-15T00:00:00.000Z",
        updatedAt: "2026-05-15T00:00:00.000Z",
      },
    ];
    const summary: OccupancySummary = {
      totalCapacity: 10,
      totalAvailableSpots: 4,
      totalOccupiedSpots: 5,
      totalReservedSpots: 1,
      zones: [
        {
          zoneId: "zone-1",
          name: "Zone A",
          description: "North parking",
          capacity: 10,
          distanceFromEntryMeters: 120,
          displayOrder: 1,
          availableSpots: 4,
          occupiedSpots: 5,
          reservedSpots: 1,
          maintenanceRequiredSpots: 0,
          occupancyRate: "60.00",
        },
      ],
    };

    const [zone] = mergeZonesWithOccupancy(zones, summary);

    expect(zone.availableSpots).toBe(4);
    expect(zone.occupancyRate).toBe("60.00");
  });

  it("uses readable status labels and colour classes", () => {
    expect(getParkingSpotStatusText("available")).toBe("Available");
    expect(getParkingSpotStatusText("maintenanceRequired")).toBe("Maintenance");
    expect(getParkingSpotStatusClass("reserved")).toContain("parking-status-reserved");
  });

  it("surfaces backend API error messages clearly", () => {
    const apiError = new ApiError(409, {
      error: "Parking zone capacity cannot be reduced below existing spots.",
    });

    expect(getParkingInventoryErrorMessage(apiError)).toContain("capacity");
    expect(getParkingInventoryErrorMessage(new Error("network"))).toContain(
      "Unable to load parking inventory",
    );
    expect(getParkingInventoryErrorMessage(new TypeError("fetch failed"))).toContain(
      "http://127.0.0.1:3000",
    );
    expect(getParkingInventoryErrorMessage(new ApiResponseFormatError(404))).toContain(
      "Rebuild and restart",
    );
  });

  it("keeps inventory readable when occupancy summary is unavailable", () => {
    const zone: ParkingZone = {
      id: "zone-1",
      zoneCode: "A",
      name: "Zone A",
      description: null,
      capacity: 10,
      distanceFromEntryMeters: null,
      displayOrder: 1,
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
    };

    expect(getZoneAvailableSpotText(zone)).toBe("Not available");
    expect(getZoneOperationalStatus(zone)).toBe("Not available");
    expect(getOptionalOccupancyWarningMessage(new TypeError("fetch failed"))).toContain(
      "Zones and spots are still shown",
    );
  });

  it("includes rowLabel in admin spot create and update payload mapping", () => {
    const createValues = createEmptySpotFormValues("zone-1");
    const createPayload = toParkingSpotRequest({
      ...createValues,
      spotCode: "A-010",
      status: "available",
      level: "Ground",
      rowLabel: "A",
    });

    expect(createPayload).toEqual({
      zoneId: "zone-1",
      spotCode: "A-010",
      status: "available",
      level: "Ground",
      rowLabel: "A",
    });

    const existingSpot: ParkingSpot = {
      id: "spot-1",
      zoneId: "zone-1",
      spotCode: "A-010",
      status: "reserved",
      level: "Level 2",
      rowLabel: "B",
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
    };
    const updatePayload = toParkingSpotRequest(createSpotFormValues(existingSpot));

    expect(updatePayload).toEqual({
      zoneId: "zone-1",
      spotCode: "A-010",
      status: "reserved",
      level: "Level 2",
      rowLabel: "B",
    });
  });

  it("includes optional default spot level in create-zone request mapping", () => {
    const values = createEmptyZoneFormValues();
    const requestWithDefaultLevel = toParkingZoneRequest({
      ...values,
      zoneCode: " D ",
      name: "Zone D",
      capacity: "12",
      defaultSpotLevel: " Level 2 ",
    });

    expect(requestWithDefaultLevel.defaultSpotLevel).toBe("Level 2");
    expect(requestWithDefaultLevel.zoneCode).toBe("D");

    const requestWithoutDefaultLevel = toParkingZoneRequest({
      ...values,
      zoneCode: "E",
      name: "Zone E",
      capacity: "8",
      defaultSpotLevel: "   ",
    });

    expect(requestWithoutDefaultLevel.defaultSpotLevel).toBeUndefined();
  });

  it("validates bulk level update form values", () => {
    const values = createBulkLevelFormValues();
    const invalidErrors = validateBulkLevelForm(values, [{ id: "zone-1" }]);

    expect(bulkLevelFormHasErrors(invalidErrors)).toBe(true);
    expect(invalidErrors.zoneId).toBe("Choose an existing zone");
    expect(invalidErrors.level).toBe("Level is required");

    const validErrors = validateBulkLevelForm(
      {
        zoneId: "zone-1",
        level: "Ground",
        targetMode: "all",
        rangeFrom: "",
        rangeTo: "",
      },
      [{ id: "zone-1" }],
    );

    expect(bulkLevelFormHasErrors(validErrors)).toBe(false);
  });

  it("defaults bulk level form to all-spots mode", () => {
    const values = createBulkLevelFormValues("zone-1");

    expect(values.targetMode).toBe("all");
    expect(values.rangeFrom).toBe("");
    expect(values.rangeTo).toBe("");
  });

  it("validates range inputs when range mode is selected", () => {
    const values = {
      ...createBulkLevelFormValues("zone-1"),
      level: "Ground",
      targetMode: "range" as const,
      rangeFrom: "10",
      rangeTo: "1",
    };
    const errors = validateBulkLevelForm(values, [{ id: "zone-1" }]);

    expect(errors.rangeTo).toBe("To number must be greater than or equal to from number");
  });

  it("builds padded range preview from selected zone code", () => {
    const preview = getBulkLevelRangePreview(
      {
        ...createBulkLevelFormValues("zone-1"),
        targetMode: "range",
        rangeFrom: "1",
        rangeTo: "10",
      },
      [{ id: "zone-1", zoneCode: "ZT" }],
    );

    expect(preview).toBe("Will update ZT-001 to ZT-010");
  });

  it("defaults Spots tab to table-focused mode with no side panel", () => {
    const defaultMode = createDefaultSpotPanelMode();

    expect(defaultMode).toBe("none");
    expect(shouldShowSpotEditorPanel(defaultMode)).toBe(false);
    expect(shouldShowBulkLevelPanel(defaultMode)).toBe(false);
  });

  it("shows only one Spots panel at a time when switched", () => {
    const createMode: SpotPanelMode = "createSpot";
    expect(shouldShowSpotEditorPanel(createMode)).toBe(true);
    expect(shouldShowBulkLevelPanel(createMode)).toBe(false);

    const bulkMode: SpotPanelMode = "bulkLevel";
    expect(shouldShowSpotEditorPanel(bulkMode)).toBe(false);
    expect(shouldShowBulkLevelPanel(bulkMode)).toBe(true);
  });
});
