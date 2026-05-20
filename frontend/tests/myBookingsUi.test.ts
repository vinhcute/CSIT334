import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  MyBookingsPage,
  getBookingStatusClass,
  getBookingStatusLabel,
  getMyBookingsErrorMessage,
  isBookingCancellable,
  splitBookingsByTimeline,
} from "../src/features/parking/MyBookingsPage.js";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";
import type { BookingSummary } from "../src/services/bookingsApi.js";

function bookingFactory(overrides: Partial<BookingSummary>): BookingSummary {
  return {
    id: "booking-1",
    userId: "user-1",
    spotId: "spot-1",
    status: "confirmed",
    startTime: "2026-05-20T01:00:00.000Z",
    endTime: "2026-05-20T03:00:00.000Z",
    expiresAt: "2026-05-20T01:15:00.000Z",
    createdAt: "2026-05-15T01:00:00.000Z",
    updatedAt: "2026-05-15T01:00:00.000Z",
    spot: {
      id: "spot-1",
      zoneId: "zone-1",
      spotCode: "D-12",
      status: "reserved",
      level: "Ground",
      rowLabel: "D",
      zone: {
        id: "zone-1",
        name: "Zone D",
        distanceFromEntryMeters: 100,
        displayOrder: 1,
      },
    },
    ...overrides,
  };
}

describe("my bookings UI rules", () => {
  it("exports the my bookings component", () => {
    const element = createElement(MyBookingsPage);
    expect(element.type).toBe(MyBookingsPage);
  });

  it("groups current/upcoming and past bookings correctly", () => {
    const now = new Date("2026-05-19T00:00:00.000Z");
    const upcoming = bookingFactory({ id: "upcoming-1", startTime: "2026-05-20T01:00:00.000Z" });
    const past = bookingFactory({
      id: "past-1",
      status: "expired",
      startTime: "2026-05-18T01:00:00.000Z",
      endTime: "2026-05-18T02:00:00.000Z",
    });

    const grouped = splitBookingsByTimeline([upcoming, past], now);

    expect(grouped.upcoming.map((booking) => booking.id)).toEqual(["upcoming-1"]);
    expect(grouped.past.map((booking) => booking.id)).toEqual(["past-1"]);
  });

  it("only allows cancel action for eligible upcoming bookings", () => {
    const now = new Date("2026-05-19T00:00:00.000Z");

    expect(isBookingCancellable(bookingFactory({ status: "confirmed" }), now)).toBe(true);
    expect(
      isBookingCancellable(
        bookingFactory({ status: "cancelled", startTime: "2026-05-20T01:00:00.000Z" }),
        now,
      ),
    ).toBe(false);
    expect(
      isBookingCancellable(
        bookingFactory({ status: "confirmed", startTime: "2026-05-18T01:00:00.000Z" }),
        now,
      ),
    ).toBe(false);
  });

  it("uses readable booking status labels and classes", () => {
    expect(getBookingStatusLabel("confirmed")).toBe("Confirmed");
    expect(getBookingStatusLabel("cancelled")).toBe("Cancelled");
    expect(getBookingStatusClass("expired")).toContain("booking-status-expired");
  });

  it("shows API error message text when available", () => {
    const message = getMyBookingsErrorMessage(
      new ApiError(409, { error: "Only upcoming bookings can be cancelled." }),
    );

    expect(message).toContain("upcoming");
  });

  it("shows backend-route hint for non-JSON booking responses", () => {
    const message = getMyBookingsErrorMessage(new ApiResponseFormatError(404));

    expect(message).toContain("Rebuild/restart backend");
  });
});
