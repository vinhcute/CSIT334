import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ApiError, ApiResponseFormatError } from "../src/services/apiClient.js";
import type { SafeUser } from "../src/features/auth/authTypes.js";
import {
  ReportIssuePage,
  canViewReportIssue,
  getIncidentStatusClass,
  getIncidentStatusLabel,
  getIssueTypeLabel,
  getReportIssueErrorMessage,
  getReportIssueValidationError,
} from "../src/features/parking/ReportIssuePage.js";

const driverUser: SafeUser = {
  id: "driver-1",
  email: "driver@example.test",
  role: "driver",
  accountStatus: "active",
};

const adminUser: SafeUser = {
  id: "admin-1",
  email: "admin@example.test",
  role: "admin",
  accountStatus: "active",
};

describe("report issue UI rules", () => {
  it("exports a report issue page", () => {
    const element = createElement(ReportIssuePage);

    expect(element.type).toBe(ReportIssuePage);
  });

  it("limits report issue page to driver accounts", () => {
    expect(canViewReportIssue(driverUser)).toBe(true);
    expect(canViewReportIssue(adminUser)).toBe(false);
    expect(canViewReportIssue(null)).toBe(false);
  });

  it("formats issue and status labels", () => {
    expect(getIssueTypeLabel("spotDiscrepancy")).toBe("Spot discrepancy");
    expect(getIssueTypeLabel("paymentIssue")).toBe("Payment issue");
    expect(getIncidentStatusLabel("open")).toBe("Open");
    expect(getIncidentStatusLabel("inReview")).toBe("In review");
    expect(getIncidentStatusClass("resolved")).toBe("incident-status incident-status-resolved");
  });

  it("validates issue submission fields", () => {
    expect(getReportIssueValidationError("invalid", "Valid description text here.")).toContain(
      "issue type",
    );
    expect(getReportIssueValidationError("other", "short")).toContain("at least 10");
    expect(getReportIssueValidationError("other", "a".repeat(1001))).toContain(
      "cannot exceed 1000",
    );
    expect(
      getReportIssueValidationError(
        "sensorFault",
        "Sensor and spot status did not match during entry.",
      ),
    ).toBeNull();
  });

  it("surfaces incident API errors clearly", () => {
    expect(
      getReportIssueErrorMessage(
        new ApiError(400, {
          error: "Incident report input is invalid.",
          issues: ["Description must be at least 10 characters."],
        }),
      ),
    ).toBe("Description must be at least 10 characters.");
    expect(getReportIssueErrorMessage(new ApiError(403, { error: "Forbidden." }))).toBe(
      "Forbidden.",
    );
    expect(getReportIssueErrorMessage(new ApiResponseFormatError(404))).toContain(
      "Rebuild and restart",
    );
    expect(getReportIssueErrorMessage(new Error("network"))).toContain(
      "Unable to load incident reporting data",
    );
  });
});
