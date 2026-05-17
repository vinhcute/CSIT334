import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  REPORT_ISSUE_TYPES,
  ReportIssuePage,
  filterReportIssueSpots,
  getReportIssueSpotStatusText,
  validateReportIssueForm,
} from "../src/features/parking/ReportIssuePage.js";
import type { ParkingSpot } from "../src/services/parkingSpotsApi.js";

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
    id: "spot-b1",
    zoneId: "zone-b",
    spotCode: "B-1",
    status: "maintenanceRequired",
    level: "Level 1",
    rowLabel: "B",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  },
];

describe("report issue UI rules", () => {
  it("exports a driver report issue component", () => {
    const element = createElement(ReportIssuePage);

    expect(element.type).toBe(ReportIssuePage);
  });

  it("uses explicit MVP issue types", () => {
    expect(REPORT_ISSUE_TYPES.map((issueType) => issueType.value)).toEqual([
      "spotDiscrepancy",
      "parkingIssue",
      "safetyConcern",
      "accessibilityIssue",
    ]);
  });

  it("validates issue type and description", () => {
    expect(
      validateReportIssueForm({
        issueType: "",
        zoneId: "",
        spotId: "",
        description: "",
      }),
    ).toEqual({
      issueType: "Issue type is required",
      description: "Description is required",
    });

    expect(
      validateReportIssueForm({
        issueType: "spotDiscrepancy",
        zoneId: "zone-a",
        spotId: "spot-a1",
        description: "The selected spot is blocked.",
      }),
    ).toEqual({});
  });

  it("filters spots by selected zone and keeps readable status labels", () => {
    expect(filterReportIssueSpots(spots, "zone-a").map((spot) => spot.spotCode)).toEqual([
      "A-1",
    ]);
    expect(filterReportIssueSpots(spots, "")).toHaveLength(2);
    expect(getReportIssueSpotStatusText("maintenanceRequired")).toBe("Maintenance");
  });
});
