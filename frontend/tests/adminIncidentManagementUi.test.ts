import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  AdminIncidentManagementPage,
  filterAdminIncidents,
  getIncidentIssueTypeLabel,
  getIncidentStatusClass,
  getIncidentStatusLabel,
  seedAdminIncidents,
  validateResolution,
} from "../src/features/admin/AdminIncidentManagementPage.js";

describe("admin incident management UI rules", () => {
  it("exports an admin incident management page", () => {
    const element = createElement(AdminIncidentManagementPage);

    expect(element.type).toBe(AdminIncidentManagementPage);
  });

  it("filters incidents by status", () => {
    expect(filterAdminIncidents(seedAdminIncidents, "all")).toHaveLength(3);
    expect(filterAdminIncidents(seedAdminIncidents, "open")).toHaveLength(1);
    expect(filterAdminIncidents(seedAdminIncidents, "inReview")).toHaveLength(1);
    expect(filterAdminIncidents(seedAdminIncidents, "resolved")).toHaveLength(1);
  });

  it("uses readable labels and status classes", () => {
    expect(getIncidentStatusLabel("inReview")).toBe("In Review");
    expect(getIncidentStatusClass("resolved")).toContain("incident-status-resolved");
    expect(getIncidentIssueTypeLabel("spotDiscrepancy")).toBe("Spot discrepancy");
  });

  it("requires resolution text before resolving incidents", () => {
    expect(validateResolution("")).toBe("Resolution is required");
    expect(validateResolution("   ")).toBe("Resolution is required");
    expect(validateResolution("Maintenance team reviewed the report.")).toBeNull();
  });
});
