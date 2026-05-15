import { describe, expect, it, vi } from "vitest";
import { createApiClient, type TokenStore } from "../src/services/apiClient.js";
import { createDetectionEventsApi } from "../src/services/detectionEventsApi.js";
import { createOccupancyApi } from "../src/services/occupancyApi.js";
import { createParkingSpotsApi } from "../src/services/parkingSpotsApi.js";
import { createParkingZonesApi } from "../src/services/parkingZonesApi.js";

function createMemoryTokenStore(token = "parking-token"): TokenStore {
  return {
    getToken: () => token,
    setToken: (nextToken) => {
      token = nextToken;
    },
    clearToken: () => {
      token = "";
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createTestClient(fetchImpl: typeof fetch) {
  return createApiClient({
    fetchImpl,
    tokenStore: createMemoryTokenStore(),
  });
}

function firstFetchCall(fetchImpl: typeof fetch): Parameters<typeof fetch> {
  return vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
}

function expectAuthHeader(fetchCall: Parameters<typeof fetch>) {
  const headers = fetchCall[1]?.headers as Headers;

  expect(headers.get("authorization")).toBe("Bearer parking-token");
}

describe("parking zones API client", () => {
  it("lists parking zones with bearer authorization", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ parkingZones: [] }),
    ) as unknown as typeof fetch;
    const parkingZonesApi = createParkingZonesApi(createTestClient(fetchImpl));

    await parkingZonesApi.listZones();

    const fetchCall = firstFetchCall(fetchImpl);
    expect(fetchCall[0]).toBe("/api/parking-zones");
    expect(fetchCall[1]?.method).toBe("GET");
    expectAuthHeader(fetchCall);
  });

  it("creates, updates, and deletes zones through admin endpoints", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        parkingZone: {
          id: "zone-1",
          name: "North",
          capacity: 10,
        },
      }),
    ) as unknown as typeof fetch;
    const parkingZonesApi = createParkingZonesApi(createTestClient(fetchImpl));

    await parkingZonesApi.createZone({ name: "North", capacity: 10 });
    await parkingZonesApi.updateZone("zone-1", { capacity: 12 });
    await parkingZonesApi.deleteZone("zone-1");

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/admin/parking-zones",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "North", capacity: 10 }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "/api/admin/parking-zones/zone-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ capacity: 12 }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "/api/admin/parking-zones/zone-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("parking spots API client", () => {
  it("lists parking spots with optional filters", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ parkingSpots: [] }),
    ) as unknown as typeof fetch;
    const parkingSpotsApi = createParkingSpotsApi(createTestClient(fetchImpl));

    await parkingSpotsApi.listSpots({
      zoneId: "zone-1",
      status: "available",
    });

    const fetchCall = firstFetchCall(fetchImpl);
    expect(fetchCall[0]).toBe("/api/parking-spots?zoneId=zone-1&status=available");
    expectAuthHeader(fetchCall);
  });

  it("lists spots for a zone route", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ parkingSpots: [] }),
    ) as unknown as typeof fetch;
    const parkingSpotsApi = createParkingSpotsApi(createTestClient(fetchImpl));

    await parkingSpotsApi.listSpotsForZone("zone-1", { status: "occupied" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/parking-zones/zone-1/parking-spots?status=occupied",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("creates, updates, and deletes spots through admin endpoints", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        parkingSpot: {
          id: "spot-1",
          zoneId: "zone-1",
          spotCode: "A-001",
          status: "available",
        },
      }),
    ) as unknown as typeof fetch;
    const parkingSpotsApi = createParkingSpotsApi(createTestClient(fetchImpl));

    await parkingSpotsApi.createSpot({
      zoneId: "zone-1",
      spotCode: "A-001",
      status: "available",
    });
    await parkingSpotsApi.updateSpot("spot-1", { status: "maintenanceRequired" });
    await parkingSpotsApi.deleteSpot("spot-1");

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/admin/parking-spots",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          zoneId: "zone-1",
          spotCode: "A-001",
          status: "available",
        }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "/api/admin/parking-spots/spot-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "maintenanceRequired" }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "/api/admin/parking-spots/spot-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("occupancy API client", () => {
  it("loads occupancy summary with authorization", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        summary: {
          totalCapacity: 10,
          totalAvailableSpots: 4,
          totalOccupiedSpots: 3,
          totalReservedSpots: 1,
          zones: [],
        },
      }),
    ) as unknown as typeof fetch;
    const occupancyApi = createOccupancyApi(createTestClient(fetchImpl));

    await occupancyApi.getSummary();

    const fetchCall = firstFetchCall(fetchImpl);
    expect(fetchCall[0]).toBe("/api/occupancy/summary");
    expectAuthHeader(fetchCall);
  });

  it("loads zone occupancy detail", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        zone: {
          zoneId: "zone-1",
          name: "North",
          capacity: 10,
          spots: [],
        },
      }),
    ) as unknown as typeof fetch;
    const occupancyApi = createOccupancyApi(createTestClient(fetchImpl));

    await occupancyApi.getZoneDetail("zone-1");

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/occupancy/zones/zone-1",
      expect.objectContaining({ method: "GET" }),
    );
  });
});

describe("detection events API client", () => {
  it("posts detection events with authorization", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        detectionEvent: {
          id: "event-1",
          spotId: "spot-1",
          type: "vehicleEntry",
        },
        parkingSpot: {
          id: "spot-1",
          zoneId: "zone-1",
          spotCode: "A-001",
          status: "occupied",
        },
      }),
    ) as unknown as typeof fetch;
    const detectionEventsApi = createDetectionEventsApi(createTestClient(fetchImpl));
    const input = {
      spotId: "spot-1",
      type: "vehicleEntry" as const,
      rawPayload: { source: "simulator" },
    };

    await detectionEventsApi.ingestDetectionEvent(input);

    const fetchCall = firstFetchCall(fetchImpl);
    expect(fetchCall[0]).toBe("/api/admin/detection-events");
    expect(fetchCall[1]?.method).toBe("POST");
    expect(fetchCall[1]?.body).toBe(JSON.stringify(input));
    expectAuthHeader(fetchCall);
  });

  it("lists recent detection events with authorization", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ detectionEvents: [] }),
    ) as unknown as typeof fetch;
    const detectionEventsApi = createDetectionEventsApi(createTestClient(fetchImpl));

    await detectionEventsApi.listRecentDetectionEvents();

    const fetchCall = firstFetchCall(fetchImpl);
    expect(fetchCall[0]).toBe("/api/admin/detection-events");
    expect(fetchCall[1]?.method).toBe("GET");
    expectAuthHeader(fetchCall);
  });
});
