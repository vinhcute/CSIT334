import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";
import {
  AdminBookingsPage,
  buildAdminBookingsFilters,
  canViewAdminBookings,
  createInitialAdminBookingFilters,
  getAdminBookingsErrorMessage,
} from "../src/features/admin/AdminBookingsPage.js";

describe("admin bookings UI rules", () => {
  it("exports the admin bookings component", () => {
    const element = createElement(AdminBookingsPage);
    expect(element.type).toBe(AdminBookingsPage);
  });

  it("allows admin accounts to view admin bookings", () => {
    expect(canViewAdminBookings({ role: "admin" } as never)).toBe(true);
    expect(canViewAdminBookings({ role: "driver" } as never)).toBe(false);
    expect(canViewAdminBookings(null)).toBe(false);
  });

  it("creates default filter values", () => {
    expect(createInitialAdminBookingFilters()).toEqual({
      status: "all",
      from: "",
      to: "",
      userSearch: "",
      zoneName: "",
    });
  });

  it("builds API filters from date-only UI values", () => {
    const filters = buildAdminBookingsFilters(
      {
        status: "confirmed",
        from: "2026-05-20",
        to: "2026-05-21",
        userSearch: "Minh",
        zoneName: "North",
      },
      1,
    );

    expect(filters.status).toBe("confirmed");
    expect(filters.from).toBeTruthy();
    expect(filters.to).toBeTruthy();
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(20);
    expect(filters.userSearch).toBe("Minh");
    expect(filters.zoneName).toBe("North");
    expect(new Date(filters.from as string).getTime()).toBeLessThan(
      new Date(filters.to as string).getTime(),
    );
  });

  it("returns validation issue details from backend", () => {
    const message = getAdminBookingsErrorMessage(
      new ApiError(400, {
        error: "Booking input is invalid.",
        issues: ["From date must be before or equal to to date."],
      }),
    );

    expect(message).toContain("From date");
  });

  it("returns permission message for forbidden responses", () => {
    const message = getAdminBookingsErrorMessage(new ApiError(403, {}));
    expect(message).toContain("Permission denied");
  });

  it("returns route guidance for non-JSON booking responses", () => {
    const message = getAdminBookingsErrorMessage(new ApiResponseFormatError(404));
    expect(message).toContain("Rebuild/restart backend");
  });
});
