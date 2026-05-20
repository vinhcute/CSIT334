import { createApiClient } from "./apiClient.js";
import type { ParkingSpotStatus } from "./parkingSpotsApi.js";

export type IncidentStatus = "open" | "inReview" | "resolved";
export type IncidentIssueType =
  | "spotDiscrepancy"
  | "sensorFault"
  | "paymentIssue"
  | "safetyConcern"
  | "other";

export interface IncidentSpotSummary {
  id: string;
  spotCode: string;
  status: ParkingSpotStatus;
  zone: {
    id: string;
    name: string;
  };
  level: string | null;
  rowLabel: string | null;
}

export interface IncidentReporterSummary {
  id: string;
  name: string;
  email: string;
}

export interface IncidentReportSummary {
  id: string;
  userId: string;
  status: IncidentStatus;
  issueType: IncidentIssueType;
  descriptionPreview: string;
  spot: IncidentSpotSummary | null;
  reporter: IncidentReporterSummary | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface IncidentReportDetail extends IncidentReportSummary {
  description: string;
  resolution: string | null;
}

export interface IncidentReportsResponse {
  incidentReports: IncidentReportSummary[];
}

export interface IncidentReportResponse {
  incidentReport: IncidentReportDetail;
}

export interface CreateIncidentReportInput {
  issueType: IncidentIssueType;
  description: string;
  spotId?: string;
}

export interface ResolveIncidentReportInput {
  resolution: string;
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
    createReport(input: CreateIncidentReportInput): Promise<IncidentReportResponse> {
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

    listAdminReports(filters: AdminIncidentReportFilters = {}): Promise<IncidentReportsResponse> {
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

      return apiClient.request<IncidentReportsResponse>(
        `/api/admin/incident-reports${query ? `?${query}` : ""}`,
        {
          authenticated: true,
        },
      );
    },

    markInReview(incidentReportId: string): Promise<IncidentReportResponse> {
      return apiClient.request<IncidentReportResponse>(
        `/api/admin/incident-reports/${incidentReportId}/in-review`,
        {
          method: "PATCH",
          authenticated: true,
        },
      );
    },

    resolveReport(
      incidentReportId: string,
      input: ResolveIncidentReportInput,
    ): Promise<IncidentReportResponse> {
      return apiClient.request<IncidentReportResponse>(
        `/api/admin/incident-reports/${incidentReportId}/resolve`,
        {
          method: "PATCH",
          body: input,
          authenticated: true,
        },
      );
    },
  };
}
