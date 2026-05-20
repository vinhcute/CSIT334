import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, ApiResponseFormatError, createApiClient } from "../../services/apiClient.js";
import {
  createIncidentReportsApi,
  type IncidentIssueType,
  type IncidentReportSummary,
  type IncidentStatus,
} from "../../services/incidentReportsApi.js";
import { getIncidentStatusClass, getIncidentStatusLabel, getIssueTypeLabel } from "../parking/ReportIssuePage.js";
import { useAuthState } from "../auth/authState.js";
import type { SafeUser } from "../auth/authTypes.js";

const sharedApiClient = createApiClient();

const INCIDENT_STATUS_OPTIONS: Array<IncidentStatus | "all"> = ["all", "open", "inReview", "resolved"];
const INCIDENT_ISSUE_TYPE_OPTIONS: Array<IncidentIssueType | "all"> = [
  "all",
  "spotDiscrepancy",
  "sensorFault",
  "paymentIssue",
  "safetyConcern",
  "other",
];

type AdminIncidentStatus = "loading" | "ready" | "empty" | "error";

interface AdminIncidentFilters {
  status: IncidentStatus | "all";
  issueType: IncidentIssueType | "all";
  spotId: string;
}

export function canViewAdminIncidents(user: SafeUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function createInitialAdminIncidentFilters(): AdminIncidentFilters {
  return {
    status: "all",
    issueType: "all",
    spotId: "",
  };
}

export function getAdminIncidentErrorMessage(error: unknown): string {
  if (error instanceof ApiResponseFormatError) {
    return "Incident routes are unavailable. Rebuild/restart backend and retry.";
  }

  if (error instanceof ApiError) {
    const body = error.body as { error?: string; issues?: string[] } | null;

    if (body?.issues?.length) {
      return body.issues.join(" ");
    }

    if (body?.error) {
      return body.error;
    }

    if (error.status === 403) {
      return "Permission denied. Admin access is required.";
    }
  }

  return "Unable to load incidents. Please retry after checking the API server.";
}

function formatIncidentDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function AdminIncidentManagementPage() {
  const { user } = useAuthState();
  const incidentReportsApi = useMemo(() => createIncidentReportsApi(sharedApiClient), []);
  const [status, setStatus] = useState<AdminIncidentStatus>("loading");
  const [incidents, setIncidents] = useState<IncidentReportSummary[]>([]);
  const [filters, setFilters] = useState<AdminIncidentFilters>(createInitialAdminIncidentFilters);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [resolvingIncidentId, setResolvingIncidentId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const loadIncidents = useCallback(async () => {
    if (!canViewAdminIncidents(user)) {
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const response = await incidentReportsApi.listAdminReports({
        status: filters.status === "all" ? undefined : filters.status,
        issueType: filters.issueType === "all" ? undefined : filters.issueType,
        spotId: filters.spotId.trim() || undefined,
      });
      setIncidents(response.incidentReports);
      setStatus(response.incidentReports.length > 0 ? "ready" : "empty");
    } catch (requestError) {
      setStatus("error");
      setError(getAdminIncidentErrorMessage(requestError));
    }
  }, [filters, incidentReportsApi, user]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  if (!canViewAdminIncidents(user)) {
    return (
      <section className="account-state account-state-error admin-state" aria-live="polite">
        <h2>Permission denied</h2>
        <p>Incident management is restricted to UniPark administrator accounts.</p>
      </section>
    );
  }

  const markInReview = async (incidentId: string) => {
    setActionError(null);
    setActionSuccess(null);

    try {
      await incidentReportsApi.markInReview(incidentId);
      setActionSuccess("Incident moved to in review.");
      await loadIncidents();
    } catch (requestError) {
      setActionError(getAdminIncidentErrorMessage(requestError));
    }
  };

  const resolveIncident = async (incidentId: string) => {
    setActionError(null);
    setActionSuccess(null);

    if (resolutionText.trim().length < 5) {
      setActionError("Resolution must be at least 5 characters.");
      return;
    }

    try {
      await incidentReportsApi.resolveReport(incidentId, { resolution: resolutionText.trim() });
      setActionSuccess("Incident resolved.");
      setResolvingIncidentId(null);
      setResolutionText("");
      await loadIncidents();
    } catch (requestError) {
      setActionError(getAdminIncidentErrorMessage(requestError));
    }
  };

  return (
    <section className="admin-incidents-page" aria-labelledby="admin-incidents-title">
      <div className="account-header">
        <p className="eyebrow">Admin Incident Controls</p>
        <h2 id="admin-incidents-title">Incidents</h2>
        <p>Review reported issues, triage statuses, and resolve incidents.</p>
      </div>

      <form
        className="admin-incidents-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void loadIncidents();
        }}
      >
        <label className="form-field">
          <span className="form-label">Status</span>
          <select
            aria-label="Filter by incident status"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as IncidentStatus | "all",
              }))
            }
            value={filters.status}
          >
            {INCIDENT_STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All statuses" : getIncidentStatusLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">Issue Type</span>
          <select
            aria-label="Filter by issue type"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                issueType: event.target.value as IncidentIssueType | "all",
              }))
            }
            value={filters.issueType}
          >
            {INCIDENT_ISSUE_TYPE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All issue types" : getIssueTypeLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">Spot ID</span>
          <input
            aria-label="Filter by spot id"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                spotId: event.target.value,
              }))
            }
            placeholder="e.g. spot-001"
            type="text"
            value={filters.spotId}
          />
        </label>
      </form>

      {actionError ? <p className="form-banner-error">{actionError}</p> : null}
      {actionSuccess ? <p className="form-success">{actionSuccess}</p> : null}

      {status === "loading" ? (
        <section className="account-state account-state-loading admin-state" aria-live="polite">
          <h2>Loading incidents...</h2>
          <span className="loading-ring" aria-hidden="true" />
        </section>
      ) : null}

      {status === "error" ? (
        <section className="account-state account-state-error admin-state" aria-live="polite">
          <h2>Unable to load incidents</h2>
          <p>{error}</p>
          <button className="primary-button" onClick={() => void loadIncidents()} type="button">
            Retry
          </button>
        </section>
      ) : null}

      {status === "empty" ? (
        <section className="account-state account-state-empty admin-state" aria-live="polite">
          <h2>No incidents found</h2>
          <p>No incident reports matched the current filters.</p>
        </section>
      ) : null}

      {status === "ready" ? (
        <div className="admin-incidents-table" role="table" aria-label="Admin incidents">
          <div className="admin-incidents-row admin-incidents-row-heading" role="row">
            <span role="columnheader">Issue</span>
            <span role="columnheader">Spot</span>
            <span role="columnheader">Reporter</span>
            <span role="columnheader">Created</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Actions</span>
          </div>

          {incidents.map((incident) => (
            <div className="admin-incidents-row" key={incident.id} role="row">
              <span role="cell">
                <strong>{getIssueTypeLabel(incident.issueType)}</strong>
                <small>{incident.descriptionPreview}</small>
              </span>
              <span role="cell">
                {incident.spot ? `${incident.spot.spotCode} (${incident.spot.zone.name})` : "General issue"}
              </span>
              <span role="cell">
                {incident.reporter?.name ?? "Unknown"}
                <small>{incident.reporter?.email ?? incident.userId}</small>
              </span>
              <span role="cell">{formatIncidentDateTime(incident.createdAt)}</span>
              <span role="cell">
                <span className={getIncidentStatusClass(incident.status)}>
                  {getIncidentStatusLabel(incident.status)}
                </span>
              </span>
              <span className="admin-incident-actions" role="cell">
                {incident.status === "open" ? (
                  <button className="secondary-button" onClick={() => void markInReview(incident.id)} type="button">
                    Mark in review
                  </button>
                ) : null}
                {incident.status !== "resolved" ? (
                  <button
                    className="primary-button"
                    onClick={() => {
                      setResolvingIncidentId(incident.id);
                      setResolutionText("");
                    }}
                    type="button"
                  >
                    Resolve
                  </button>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {resolvingIncidentId ? (
        <aside className="incident-resolve-modal" aria-label="Resolve incident">
          <h3>Resolve Incident</h3>
          <p>Add a short resolution note for audit history.</p>
          <label className="form-field report-issue-description-field">
            <span className="form-label">Resolution</span>
            <textarea
              aria-label="Resolution text"
              onChange={(event) => setResolutionText(event.target.value)}
              placeholder="Describe how this incident was resolved."
              rows={4}
              value={resolutionText}
            />
          </label>
          <div className="booking-cancel-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setResolvingIncidentId(null);
                setResolutionText("");
              }}
              type="button"
            >
              Cancel
            </button>
            <button className="primary-button" onClick={() => void resolveIncident(resolvingIncidentId)} type="button">
              Confirm resolve
            </button>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
