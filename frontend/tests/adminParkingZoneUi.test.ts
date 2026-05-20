import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ApiError } from "../src/services/apiClient.js";
import {
  AdminParkingInventoryPage,
  createEmptyZoneFormValues,
  createZoneFormValues,
  getParkingInventoryErrorMessage,
  getZoneDeleteConfirmationMessage,
  toParkingZoneRequest,
  validateZoneForm,
  zoneFormHasErrors,
} from "../src/features/admin/AdminParkingInventoryPage.js";
import type { ParkingZone } from "../src/services/parkingZonesApi.js";

const zone: ParkingZone = {
  id: "zone-1",
  zoneCode: "A",
  name: "Zone A",
  description: "North campus parking",
  capacity: 80,
  distanceFromEntryMeters: 120,
  displayOrder: 2,
  createdAt: "2026-05-15T00:00:00.000Z",
  updatedAt: "2026-05-15T00:00:00.000Z",
};

describe("admin parking zone form UI rules", () => {
  it("opens the inventory shell in zone management mode", () => {
    const element = createElement(AdminParkingInventoryPage, {
      initialView: "zones",
    });

    expect(element.type).toBe(AdminParkingInventoryPage);
    expect(element.props.initialView).toBe("zones");
  });

  it("builds create and edit zone form values", () => {
    expect(createEmptyZoneFormValues()).toEqual({
      zoneCode: "",
      name: "",
      capacity: "",
      description: "",
      distanceFromEntryMeters: "",
      displayOrder: "",
      defaultSpotLevel: "",
    });
    expect(createZoneFormValues(zone)).toMatchObject({
      zoneCode: "A",
      name: "Zone A",
      capacity: "80",
      description: "North campus parking",
      distanceFromEntryMeters: "120",
      displayOrder: "2",
    });
  });

  it("validates blank zone names and invalid capacity before submit", () => {
    const errors = validateZoneForm({
      zoneCode: "",
      name: "   ",
      capacity: "0",
      description: "",
      distanceFromEntryMeters: "",
      displayOrder: "",
      defaultSpotLevel: "",
    });

    expect(zoneFormHasErrors(errors)).toBe(true);
    expect(errors.zoneCode).toBe("Zone ID is required");
    expect(errors.name).toBe("Zone name is required");
    expect(errors.capacity).toBe("Capacity must be at least 1");
  });

  it("validates optional numeric fields when provided", () => {
    const errors = validateZoneForm({
      zoneCode: "north",
      name: "Zone B",
      capacity: "10",
      description: "",
      distanceFromEntryMeters: "-1",
      displayOrder: "1.5",
      defaultSpotLevel: "",
    });

    expect(errors.distanceFromEntryMeters).toBe("Distance must be a whole number");
    expect(errors.displayOrder).toBe("Display order must be a whole number");
    expect(errors.zoneCode).toBe("Zone ID must use 1 to 4 uppercase letters");
  });

  it("normalises form values into the backend request shape", () => {
    const request = toParkingZoneRequest({
      zoneCode: "  c ",
      name: "  Zone C ",
      capacity: "42",
      description: "  Library parking ",
      distanceFromEntryMeters: "75",
      displayOrder: "",
      defaultSpotLevel: "",
    });

    expect(request).toEqual({
      zoneCode: "C",
      name: "Zone C",
      capacity: 42,
      description: "Library parking",
      distanceFromEntryMeters: 75,
      displayOrder: 0,
    });
  });

  it("requires explicit delete confirmation copy", () => {
    expect(getZoneDeleteConfirmationMessage(zone)).toContain("Zone A");
    expect(getZoneDeleteConfirmationMessage(zone)).toContain("parking spots linked");
  });

  it("surfaces API conflict errors in page copy", () => {
    const conflictError = new ApiError(409, {
      error: "A parking zone with this name already exists.",
    });

    expect(getParkingInventoryErrorMessage(conflictError)).toBe(
      "A parking zone with this name already exists.",
    );
  });
});
