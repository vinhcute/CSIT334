import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";
import {
  PARKING_MAP_STATUS_ORDER,
  ParkingMapPage,
  filterParkingSpotsByZone,
  getParkingMapErrorMessage,
  getParkingMapStatusClass,
  getParkingMapStatusText,
  getParkingSpotTileClass,
  getZoneNameById,
  hasParkingMapData,
  type ParkingMapViewModel,
} from "../src/features/parking/ParkingMapPage.js";
import type { ParkingSpot } from "../src/services/parkingSpotsApi.js";
import type { ZoneOccupancySummary } from "../src/services/occupancyApi.js";

const zones: ZoneOccupancySummary[] = [
  {
    zoneId: "zone-a",
    name: "Zone A",
    description: "Main building",
    capacity: 2,
    distanceFromEntryMeters: 120,
    displayOrder: 1,
    availableSpots: 1,
    occupiedSpots: 1,
    reservedSpots: 0,
    maintenanceRequiredSpots: 0,
    occupancyRate: "50.00",
  },
  {
    zoneId: "zone-b",
    name: "Zone B",
    description: "Library",
    capacity: 1,
    distanceFromEntryMeters: 180,
    displayOrder: 2,
    availableSpots: 0,
    occupiedSpots: 0,
    reservedSpots: 1,
    maintenanceRequiredSpots: 0,
    occupancyRate: "100.00",
  },
];

const spots: ParkingSpot[] = [
  {
    id: "spot-a1",
    zoneId: "zone-a",
    spotCode: "A-1",
    status: "available",
    level: "Ground",
    rowLabel: "A",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  },
  {
    id: "spot-a2",
    zoneId: "zone-a",
    spotCode: "A-2",
    status: "occupied",
    level: "Ground",
    rowLabel: "A",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  },
  {
    id: "spot-b1",
    zoneId: "zone-b",
    spotCode: "B-1",
    status: "reserved",
    level: "Level 1",
    rowLabel: "B",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  },
];

describe("parking map UI rules", () => {
  it("exports a parking map component for the driver parking map section", () => {
    const element = createElement(ParkingMapPage);

    expect(element.type).toBe(ParkingMapPage);
  });

  it("detects map data and filters spots by selected zone", () => {
    const viewModel: ParkingMapViewModel = { zones, spots };

    expect(hasParkingMapData(viewModel)).toBe(true);
    expect(hasParkingMapData({ zones, spots: [] })).toBe(false);
    expect(filterParkingSpotsByZone(spots, "all")).toHaveLength(3);
    expect(filterParkingSpotsByZone(spots, "zone-a").map((spot) => spot.spotCode)).toEqual([
      "A-1",
      "A-2",
    ]);
  });

  it("maps zone names for selected spot details", () => {
    const zoneNameById = getZoneNameById(zones);

    expect(zoneNameById.get("zone-a")).toBe("Zone A");
    expect(zoneNameById.get("missing-zone")).toBeUndefined();
  });

  it("uses readable labels and distinct colour classes for every spot status", () => {
    expect(PARKING_MAP_STATUS_ORDER).toEqual([
      "available",
      "occupied",
      "reserved",
      "maintenanceRequired",
    ]);
    expect(getParkingMapStatusText("maintenanceRequired")).toBe("Maintenance");
    expect(getParkingMapStatusClass("reserved")).toContain("map-status-reserved");
    expect(getParkingSpotTileClass("available", true)).toContain(
      "parking-map-spot-selected",
    );
    expect(getParkingSpotTileClass("occupied")).toContain("parking-map-spot-occupied");
  });

  it("does not expose a booking action in the map helper output", () => {
    const labels = PARKING_MAP_STATUS_ORDER.map(getParkingMapStatusText).join(" ");

    expect(labels).not.toContain("Book");
  });

  it("keeps status words out of compact map tile class names", () => {
    const tileClass = getParkingSpotTileClass("maintenanceRequired");

    expect(tileClass).toContain("parking-map-spot-maintenanceRequired");
    expect(tileClass).not.toContain("Maintenance");
  });

  it("surfaces parking map API errors clearly", () => {
    expect(
      getParkingMapErrorMessage(new ApiError(401, { error: "Authentication required." })),
    ).toBe("Authentication required.");
    expect(getParkingMapErrorMessage(new ApiResponseFormatError(404))).toContain(
      "Rebuild and restart",
    );
    expect(getParkingMapErrorMessage(new Error("network"))).toContain(
      "Unable to load parking map data",
    );
  });
});
