import { describe, expect, it, vi } from "vitest";
import {
  consumeParkingEventBuffer,
  createParkingEventsApi,
  parseParkingUpdateMessage,
  type ParkingUpdateEvent,
} from "../src/services/parkingEventsApi.js";

const update: ParkingUpdateEvent = {
  spotId: "spot-1",
  zoneId: "zone-1",
  status: "occupied",
  zoneSummary: {
    zoneId: "zone-1",
    name: "Zone A",
    description: null,
    capacity: 10,
    distanceFromEntryMeters: 120,
    displayOrder: 1,
    availableSpots: 8,
    occupiedSpots: 1,
    reservedSpots: 1,
    maintenanceRequiredSpots: 0,
    occupancyRate: "20.00",
  },
};

function createEventStream(message: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(message));
      controller.close();
    },
  });
}

describe("parking realtime event stream", () => {
  it("parses parking-update SSE messages", () => {
    const message = `event: parking-update\ndata: ${JSON.stringify(update)}`;

    expect(parseParkingUpdateMessage(message)).toEqual(update);
    expect(parseParkingUpdateMessage(": connected")).toBeNull();
  });

  it("consumes complete messages and preserves partial buffer content", () => {
    const onUpdate = vi.fn();
    const remainder = consumeParkingEventBuffer(
      `: connected\n\nevent: parking-update\ndata: ${JSON.stringify(update)}\n\npartial`,
      onUpdate,
    );

    expect(onUpdate).toHaveBeenCalledWith(update);
    expect(remainder).toBe("partial");
  });

  it("connects to the authenticated parking event stream", async () => {
    const fetchImpl = vi.fn(async (_path: string, init?: RequestInit) => {
      expect(_path).toBe("/api/parking-events");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer realtime-token");

      return new Response(
        createEventStream(`event: parking-update\ndata: ${JSON.stringify(update)}\n\n`),
        {
          status: 200,
        },
      );
    }) as unknown as typeof fetch;
    const onUpdate = vi.fn();
    const onDisconnect = vi.fn();
    const parkingEventsApi = createParkingEventsApi(
      { getToken: () => "realtime-token" },
      fetchImpl,
    );

    parkingEventsApi.subscribeToParkingUpdates({ onDisconnect, onUpdate });
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith(update));

    expect(onDisconnect).toHaveBeenCalled();
  });

  it("parking update payloads do not include sensitive user fields", () => {
    const serializedUpdate = JSON.stringify(update);

    expect(serializedUpdate).not.toContain("password");
    expect(serializedUpdate).not.toContain("token");
    expect(serializedUpdate).not.toContain("universityId");
    expect(serializedUpdate).not.toContain("licensePlate");
    expect(serializedUpdate).not.toContain("licence");
  });
});
