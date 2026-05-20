import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";
import {
  AdminSensorEventsPage,
  DETECTION_EVENT_TYPE_OPTIONS,
  canViewAdminSensorEvents,
  createEmptySensorEventFormValues,
  getDetectionEventResultStatus,
  getDetectionEventSpotDisplay,
  getDetectionEventTypeText,
  getParkingSpotStatusText,
  getSensorEventErrorMessage,
  isDetectionEventType,
  sensorEventFormHasErrors,
  toIngestDetectionEventRequest,
  validateSensorEventForm,
} from "../src/features/admin/AdminSensorEventsPage.js";
import type { SafeUser } from "../src/features/auth/authTypes.js";
import type { ParkingSpot } from "../src/services/parkingSpotsApi.js";
import type { DetectionEvent } from "../src/services/detectionEventsApi.js";

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

const spot: ParkingSpot = {
  id: "spot-1",
  zoneId: "zone-1",
  spotCode: "A-001",
  status: "available",
  level: "Ground",
  rowLabel: "A",
  createdAt: "2026-05-15T00:00:00.000Z",
  updatedAt: "2026-05-15T00:00:00.000Z",
};

describe("admin simulated sensor events UI rules", () => {
  it("exports an admin sensor events page", () => {
    const element = createElement(AdminSensorEventsPage);

    expect(element.type).toBe(AdminSensorEventsPage);
  });

  it("limits the simulator to administrator accounts", () => {
    expect(canViewAdminSensorEvents(adminUser)).toBe(true);
    expect(canViewAdminSensorEvents(driverUser)).toBe(false);
    expect(canViewAdminSensorEvents(null)).toBe(false);
  });

  it("uses only simulated vehicle entry and exit event types", () => {
    expect(DETECTION_EVENT_TYPE_OPTIONS).toEqual(["vehicleEntry", "vehicleExit"]);
    expect(isDetectionEventType("vehicleEntry")).toBe(true);
    expect(isDetectionEventType("cameraDetection")).toBe(false);
    expect(getDetectionEventTypeText("vehicleEntry")).toBe("Vehicle Entry");
    expect(getDetectionEventTypeText("vehicleExit")).toBe("Vehicle Exit");
  });

  it("maps simulated events to updated parking spot statuses", () => {
    expect(getDetectionEventResultStatus("vehicleEntry")).toBe("occupied");
    expect(getDetectionEventResultStatus("vehicleExit")).toBe("available");
    expect(getParkingSpotStatusText(getDetectionEventResultStatus("vehicleEntry"))).toBe(
      "Occupied",
    );
  });

  it("prefers backend-provided spotCode for event rows", () => {
    const eventWithSpot = {
      id: "event-1",
      spotId: "spot-100",
      spot: { id: "spot-1", zoneId: "zone-1", spotCode: "ZT-001" },
      type: "vehicleEntry",
      occurredAt: "2026-05-15T00:00:00.000Z",
      rawPayload: null,
      createdAt: "2026-05-15T00:00:00.000Z",
    } satisfies DetectionEvent;
    const eventWithoutSpot = {
      ...eventWithSpot,
      id: "event-2",
      spot: null,
    } satisfies DetectionEvent;

    expect(getDetectionEventSpotDisplay(eventWithSpot)).toBe("ZT-001");
    expect(getDetectionEventSpotDisplay(eventWithoutSpot)).toBe("Unknown spot");
    expect(getDetectionEventSpotDisplay(eventWithSpot)).not.toBe("spot-100");
  });

  it("validates spot selection and event type before submit", () => {
    const errors = validateSensorEventForm(
      { spotId: "missing", type: "invalid" },
      [spot],
    );

    expect(sensorEventFormHasErrors(errors)).toBe(true);
    expect(errors.spotId).toBe("Choose an existing parking spot");
    expect(errors.type).toBe("Choose a valid sensor event");
  });

  it("normalises form values into the ingest request", () => {
    expect(createEmptySensorEventFormValues("spot-1")).toEqual({
      spotId: "spot-1",
      type: "vehicleEntry",
    });
    expect(
      toIngestDetectionEventRequest({ spotId: "spot-1", type: "vehicleExit" }),
    ).toEqual({
      spotId: "spot-1",
      type: "vehicleExit",
      rawPayload: { source: "admin-simulator" },
    });
  });

  it("surfaces rejected sensor events and stale backend responses", () => {
    const reservedConflict = new ApiError(409, {
      error: "Detection events cannot update reserved spots.",
    });

    expect(getSensorEventErrorMessage(reservedConflict)).toContain("reserved");
    expect(getSensorEventErrorMessage(new ApiResponseFormatError(404))).toContain(
      "Rebuild and restart",
    );
    expect(getSensorEventErrorMessage(new Error("network"))).toContain(
      "Unable to process the simulated sensor event",
    );
  });
});
