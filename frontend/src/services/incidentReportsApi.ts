import { createApiClient } from "./apiClient.js";

export type IncidentStatus = "open" | "inReview" | "resolved";
export type IncidentIssueType =
  | "spotDiscrepancy"
  | "parkingIssue"
  | "safetyConcern"
  | "accessibilityIssue";

export interface IncidentReporter {
  id: string;
  name: string;
  email: string;
  role: "driver" | "admin";
  accountStatus: string;
}

export interface IncidentParkingSpot {
  id: string;
  spotCode: string;
  status: string;
  level: string | null;
  rowLabel: string | null;
  zone: {
    id: string;
    name: string;
  };
}

export interface IncidentReport {
  id: string;
  userId: string;
  spotId: string | null;
  status: IncidentStatus;
  issueType: IncidentIssueType;
  description: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: IncidentReporter;
  spot: IncidentParkingSpot | null;
}

export interface CreateIncidentReportRequest {
  issueType: IncidentIssueType;
  description: string;
  spotId?: string;
}

export interface ResolveIncidentReportRequest {
  resolution: string;
}

export interface IncidentReportsResponse {
  incidentReports: IncidentReport[];
}

export interface IncidentReportResponse {
  incidentReport: IncidentReport;
}

export interface AdminIncidentReportFilters {
  status?: IncidentStatus;
  issueType?: IncidentIssueType;
  spotId?: string;
}

export type IncidentReportsApiClient = ReturnType<typeof createApiClient>;

export function createIncidentReportsApi(
  apiClient: IncidentReportsApiClient = createApiClient(),
) {
  return {
    createReport(input: CreateIncidentReportRequest): Promise<IncidentReportResponse> {
      return apiClient.request<IncidentReportResponse>("/api/incident-reports", {
        method: "POST",
        body: input,
        authenticated: true,
      });
    },

    listMyReports(): Promise<IncidentReportsResponse> {
      return apiClient.request<IncidentReportsResponse>("/api/incident-reports/me", {
        authenticated: true,
      });
    },

    listAdminReports(
      filters: AdminIncidentReportFilters = {},
    ): Promise<IncidentReportsResponse> {
      return apiClient.request<IncidentReportsResponse>(buildAdminReportsPath(filters), {
        authenticated: true,
      });
    },

    markInReview(incidentId: string): Promise<IncidentReportResponse> {
      return apiClient.request<IncidentReportResponse>(
        `/api/admin/incident-reports/${incidentId}/in-review`,
        {
          method: "PATCH",
          authenticated: true,
        },
      );
    },

    resolveReport(
      incidentId: string,
      input: ResolveIncidentReportRequest,
    ): Promise<IncidentReportResponse> {
      return apiClient.request<IncidentReportResponse>(
        `/api/admin/incident-reports/${incidentId}/resolve`,
        {
          method: "PATCH",
          body: input,
          authenticated: true,
        },
      );
    },
  };
}

function buildAdminReportsPath(filters: AdminIncidentReportFilters): string {
  const searchParams = new URLSearchParams();

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  if (filters.issueType) {
    searchParams.set("issueType", filters.issueType);
  }

  if (filters.spotId) {
    searchParams.set("spotId", filters.spotId);
  }

  const query = searchParams.toString();

  return `/api/admin/incident-reports${query ? `?${query}` : ""}`;
}
