import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";
import {
  PARKING_MAP_STATUS_ORDER,
  ParkingMapPage,
  filterParkingSpotsByZone,
  getSelectedSpotDetailRows,
  loadParkingMapViewModel,
  getSpotBookabilityMessage,
  getParkingMapErrorMessage,
  getParkingMapStatusClass,
  getParkingMapStatusText,
  getParkingSpotTileClass,
  getZoneNameById,
  hasParkingMapData,
  isSpotBookable,
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

  it("loads the full spot dataset across paginated responses", async () => {
    const summaryApi = {
      getSummary: async () => ({
        summary: {
          totalCapacity: 3,
          totalAvailableSpots: 1,
          totalOccupiedSpots: 1,
          totalReservedSpots: 1,
          zones,
        },
      }),
    };
    const paginatedSpots = [
      ...Array.from({ length: 20 }, (_, index) => ({
        ...spots[0],
        id: `spot-page-1-${index + 1}`,
        spotCode: `B-${String(index + 1).padStart(3, "0")}`,
      })),
      {
        ...spots[1],
        id: "spot-page-2-1",
        spotCode: "B-021",
        level: "Level 2",
        rowLabel: "B",
      },
    ];
    const parkingSpotsApi = {
      listAllSpots: async () => paginatedSpots,
    };

    const viewModel = await loadParkingMapViewModel(summaryApi, parkingSpotsApi);

    expect(viewModel.zones).toEqual(zones);
    expect(viewModel.spots).toHaveLength(21);
    expect(viewModel.spots.some((spot) => spot.spotCode === "B-021")).toBe(true);
  });

  it("keeps selected-spot fields driven by real API spot values", () => {
    const selectedSpot = {
      ...spots[2],
      level: "Level 3",
      rowLabel: "B",
    };

    expect(selectedSpot.id).toBe("spot-b1");
    expect(selectedSpot.zoneId).toBe("zone-b");
    expect(getZoneNameById(zones).get(selectedSpot.zoneId)).toBe("Zone B");
    expect(selectedSpot.spotCode).toBe("B-1");
    expect(getParkingMapStatusText(selectedSpot.status)).toBe("Reserved");
    const selectedRows = getSelectedSpotDetailRows(selectedSpot, zones[1]);

    expect(selectedRows.find((row) => row.label === "Level")?.value).toBe("Level 3");
    expect(selectedRows.find((row) => row.label === "Zone availability")?.value).toBe(
      "0 / 1 available",
    );
    expect(selectedRows.some((row) => row.label === "Row")).toBe(false);
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

  it("only allows booking for drivers on available spots", () => {
    expect(isSpotBookable("available", "driver")).toBe(true);
    expect(isSpotBookable("occupied", "driver")).toBe(false);
    expect(isSpotBookable("reserved", "driver")).toBe(false);
    expect(isSpotBookable("maintenanceRequired", "driver")).toBe(false);
    expect(isSpotBookable("available", "admin")).toBe(false);
  });

  it("returns readable non-bookable reasons for selected spots", () => {
    expect(getSpotBookabilityMessage("available", "driver")).toBeNull();
    expect(getSpotBookabilityMessage("occupied", "driver")).toContain("occupied");
    expect(getSpotBookabilityMessage("reserved", "driver")).toContain("reserved");
    expect(getSpotBookabilityMessage("maintenanceRequired", "driver")).toContain(
      "maintenance",
    );
    expect(getSpotBookabilityMessage("available", "admin")).toContain("Only drivers");
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
