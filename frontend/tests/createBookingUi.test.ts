import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";
import {
  CreateBookingPage,
  getCreateBookingErrorMessage,
  toDateTimeLocalInputValue,
  validateCreateBookingInput,
} from "../src/features/parking/CreateBookingPage.js";

describe("create booking UI rules", () => {
  it("exports a create booking component", () => {
    const element = createElement(CreateBookingPage, {
      selectedSpotId: "spot-1",
      onBackToMap: () => undefined,
      onOpenMyBookings: () => undefined,
    });

    expect(element.type).toBe(CreateBookingPage);
  });

  it("requires selected spot and both time fields", () => {
    const issues = validateCreateBookingInput({
      spotId: null,
      vehicleProfileId: null,
      startTime: "",
      endTime: "",
      now: new Date("2026-05-15T00:00:00.000Z"),
    });

    expect(issues.spotId).toContain("select");
    expect(issues.vehicleProfileId).toContain("required");
    expect(issues.startTime).toContain("required");
    expect(issues.endTime).toContain("required");
  });

  it("rejects past start time and end time before start", () => {
    const issues = validateCreateBookingInput({
      spotId: "spot-1",
      vehicleProfileId: "vehicle-1",
      startTime: "2026-05-14T22:00",
      endTime: "2026-05-14T21:00",
      now: new Date("2026-05-15T00:00:00.000Z"),
    });

    expect(issues.startTime).toContain("future");
    expect(issues.endTime).toContain("after start");
  });

  it("returns no validation errors for a valid future window", () => {
    const issues = validateCreateBookingInput({
      spotId: "spot-1",
      vehicleProfileId: "vehicle-1",
      startTime: "2030-05-15T02:00",
      endTime: "2030-05-15T03:00",
      now: new Date("2026-05-15T00:00:00.000Z"),
    });

    expect(Object.keys(issues)).toHaveLength(0);
  });

  it("maps conflict API errors to readable conflict messages", () => {
    const message = getCreateBookingErrorMessage(
      new ApiError(409, { error: "This parking spot already has an overlapping booking." }),
    );

    expect(message).toContain("overlapping booking");
  });

  it("maps permit eligibility failures to readable subscription guidance", () => {
    const message = getCreateBookingErrorMessage(
      new ApiError(403, { error: "An active parking permit is required for this booking window." }),
    );

    expect(message).toContain("permit");
  });

  it("maps non-JSON booking responses to backend route guidance", () => {
    const message = getCreateBookingErrorMessage(new ApiResponseFormatError(404));

    expect(message).toContain("Rebuild/restart backend");
  });

  it("formats date values for datetime-local inputs", () => {
    const value = toDateTimeLocalInputValue(new Date("2026-05-15T02:34:00.000Z"));

    expect(value.length).toBe(16);
    expect(value.includes("T")).toBe(true);
  });
});
