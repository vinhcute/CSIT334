import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";
import {
  AdminIncidentManagementPage,
  canViewAdminIncidents,
  createInitialAdminIncidentFilters,
  getAdminIncidentErrorMessage,
} from "../src/features/admin/AdminIncidentManagementPage.js";

describe("admin incidents UI rules", () => {
  it("exports the admin incidents component", () => {
    const element = createElement(AdminIncidentManagementPage);
    expect(element.type).toBe(AdminIncidentManagementPage);
  });

  it("allows only admin accounts to view incident management", () => {
    expect(canViewAdminIncidents({ role: "admin" } as never)).toBe(true);
    expect(canViewAdminIncidents({ role: "driver" } as never)).toBe(false);
    expect(canViewAdminIncidents(null)).toBe(false);
  });

  it("creates default filter values", () => {
    expect(createInitialAdminIncidentFilters()).toEqual({
      status: "all",
      issueType: "all",
      spotId: "",
    });
  });

  it("returns validation issue details from backend", () => {
    const message = getAdminIncidentErrorMessage(
      new ApiError(400, {
        error: "Incident report input is invalid.",
        issues: ["Resolution must be at least 5 characters."],
      }),
    );

    expect(message).toContain("Resolution");
  });

  it("returns permission message for forbidden responses", () => {
    const message = getAdminIncidentErrorMessage(new ApiError(403, {}));
    expect(message).toContain("Permission denied");
  });

  it("returns route guidance for non-JSON incident responses", () => {
    const message = getAdminIncidentErrorMessage(new ApiResponseFormatError(404));
    expect(message).toContain("Rebuild/restart backend");
  });
});
