import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ApiError } from "../src/services/apiClient.js";
import {
  AdminParkingInventoryPage,
  PARKING_SPOT_STATUS_OPTIONS,
  createEmptySpotFormValues,
  createSpotFormValues,
  getGeneratedSpotCodePreviewText,
  getParkingInventoryErrorMessage,
  getParkingSpotStatusClass,
  getParkingSpotStatusText,
  getSpotDeleteConfirmationMessage,
  isParkingSpotStatus,
  spotFormHasErrors,
  toParkingSpotRequest,
  validateSpotForm,
} from "../src/features/admin/AdminParkingInventoryPage.js";
import type { ParkingSpot } from "../src/services/parkingSpotsApi.js";
import type { ParkingZone } from "../src/services/parkingZonesApi.js";

const zone: ParkingZone = {
  id: "zone-1",
  zoneCode: "A",
  name: "Zone A",
  description: "North campus parking",
  capacity: 80,
  distanceFromEntryMeters: 120,
  displayOrder: 1,
  createdAt: "2026-05-15T00:00:00.000Z",
  updatedAt: "2026-05-15T00:00:00.000Z",
};

const spot: ParkingSpot = {
  id: "spot-1",
  zoneId: "zone-1",
  spotCode: "A-17",
  status: "maintenanceRequired",
  level: "Ground",
  rowLabel: "A",
  createdAt: "2026-05-15T00:00:00.000Z",
  updatedAt: "2026-05-15T00:00:00.000Z",
};

describe("admin parking spot form UI rules", () => {
  it("opens the inventory shell in spot management mode", () => {
    const element = createElement(AdminParkingInventoryPage, {
      initialView: "spots",
    });

    expect(element.type).toBe(AdminParkingInventoryPage);
    expect(element.props.initialView).toBe("spots");
  });

  it("builds create and edit spot form values", () => {
    expect(createEmptySpotFormValues("zone-1")).toEqual({
      zoneId: "zone-1",
      spotCode: "",
      status: "available",
      level: "",
      rowLabel: "",
    });
    expect(createSpotFormValues(spot)).toEqual({
      zoneId: "zone-1",
      spotCode: "A-17",
      status: "maintenanceRequired",
      level: "Ground",
      rowLabel: "A",
    });
  });

  it("validates zone and exact schema status values while allowing generated spot codes", () => {
    const errors = validateSpotForm(
      {
        zoneId: "missing-zone",
        spotCode: "   ",
        status: "blocked",
        level: "",
        rowLabel: "",
      },
      [zone],
    );

    expect(spotFormHasErrors(errors)).toBe(true);
    expect(errors.zoneId).toBe("Choose an existing zone");
    expect(errors.spotCode).toBeUndefined();
    expect(errors.status).toBe("Choose a valid status");
    expect(PARKING_SPOT_STATUS_OPTIONS).toEqual([
      "available",
      "occupied",
      "reserved",
      "maintenanceRequired",
    ]);
    expect(isParkingSpotStatus("reserved")).toBe(true);
    expect(isParkingSpotStatus("blocked")).toBe(false);
  });

  it("normalises spot form values into the backend request shape", () => {
    const request = toParkingSpotRequest({
      zoneId: "zone-1",
      spotCode: "  D-12 ",
      status: "reserved",
      level: "  Level 1 ",
      rowLabel: "  D ",
    });

    expect(request).toEqual({
      zoneId: "zone-1",
      spotCode: "D-12",
      status: "reserved",
      level: "Level 1",
      rowLabel: "D",
    });

    expect(
      toParkingSpotRequest({
        zoneId: "zone-1",
        spotCode: "D-13",
        status: "available",
        level: "",
        rowLabel: "",
      }),
    ).toMatchObject({ level: null, rowLabel: null });
    expect(
      toParkingSpotRequest({
        zoneId: "zone-1",
        spotCode: "",
        status: "available",
        level: "",
        rowLabel: "",
      }),
    ).toMatchObject({ spotCode: undefined });
  });

  it("shows generated spot code preview text without requiring row label UI", () => {
    expect(getGeneratedSpotCodePreviewText("B-021")).toBe("B-021");
    expect(getGeneratedSpotCodePreviewText("")).toBe("Generated when created");
  });

  it("requires explicit delete confirmation copy", () => {
    expect(getSpotDeleteConfirmationMessage(spot)).toContain("A-17");
    expect(getSpotDeleteConfirmationMessage(spot)).toContain("remove parking spot");
  });

  it("uses readable status text, colour classes, and conflict messages", () => {
    const conflictError = new ApiError(409, {
      error: "A parking spot with this code already exists in the selected zone.",
    });

    expect(getParkingSpotStatusText("maintenanceRequired")).toBe("Maintenance");
    expect(getParkingSpotStatusClass("available")).toContain("parking-status-available");
    expect(getParkingInventoryErrorMessage(conflictError)).toContain("already exists");
  });
});
