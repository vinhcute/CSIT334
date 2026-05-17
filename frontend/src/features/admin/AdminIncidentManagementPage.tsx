import { useEffect, useMemo, useState } from "react";
import { ApiError, ApiResponseFormatError } from "../../services/apiClient.js";
import {
  createIncidentReportsApi,
  type IncidentIssueType,
  type IncidentReport,
  type IncidentStatus,
} from "../../services/incidentReportsApi.js";
import { useAuthState } from "../auth/authState.js";
import type { SafeUser } from "../auth/authTypes.js";

export interface AdminIncidentSummary {
  id: string;
  issueType: IncidentIssueType;
  description: string;
  status: IncidentStatus;
  createdAt: string;
  zoneName: string | null;
  spotCode: string | null;
  reporterName: string;
  resolution: string | null;
}

type IncidentStatusFilter = "all" | IncidentStatus;

interface PendingIncidentResolution {
  incidentId: string;
  resolution: string;
  error: string | null;
}

export const INCIDENT_STATUS_FILTERS: IncidentStatusFilter[] = [
  "all",
  "open",
  "inReview",
  "resolved",
];

export const testAdminIncidents: AdminIncidentSummary[] = [
  {
    id: "incident-001",
    issueType: "spotDiscrepancy",
    description: "Spot A-12 is shown as available, but a vehicle is parked there.",
    status: "open",
    createdAt: "2026-05-17T08:20:00.000Z",
    zoneName: "North Campus",
    spotCode: "A-12",
    reporterName: "UI Test Driver",
    resolution: null,
  },
  {
    id: "incident-002",
    issueType: "accessibilityIssue",
    description: "Accessible bay signage near the library entrance is blocked.",
    status: "inReview",
    createdAt: "2026-05-17T07:45:00.000Z",
    zoneName: "Library Parking",
    spotCode: "B-04",
    reporterName: "Professor Smith",
    resolution: null,
  },
  {
    id: "incident-003",
    issueType: "parkingIssue",
    description: "Payment permit scanner at the east gate intermittently fails.",
    status: "resolved",
    createdAt: "2026-05-16T16:10:00.000Z",
    zoneName: "East Gate",
    spotCode: null,
    reporterName: "Campus Security",
    resolution: "Scanner rebooted and access logs confirmed normal operation.",
  },
];

export const seedAdminIncidents = testAdminIncidents;

const incidentReportsApi = createIncidentReportsApi();

export function canViewAdminIncidents(user: SafeUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function getIncidentStatusClass(status: IncidentStatus): string {
  return `incident-status incident-status-${status}`;
}

export function getIncidentStatusLabel(status: IncidentStatus): string {
  const labels: Record<IncidentStatus, string> = {
    open: "Open",
    inReview: "In Review",
    resolved: "Resolved",
  };

  return labels[status];
}

export function getIncidentIssueTypeLabel(issueType: IncidentIssueType): string {
  const labels: Record<IncidentIssueType, string> = {
    spotDiscrepancy: "Spot discrepancy",
    parkingIssue: "Parking issue",
    safetyConcern: "Safety concern",
    accessibilityIssue: "Accessibility issue",
  };

  return labels[issueType];
}

export function filterAdminIncidents(
  incidents: AdminIncidentSummary[],
  filter: IncidentStatusFilter,
): AdminIncidentSummary[] {
  if (filter === "all") {
    return incidents;
  }

  return incidents.filter((incident) => incident.status === filter);
}

export function validateResolution(resolution: string): string | null {
  const trimmedResolution = resolution.trim();

  if (!trimmedResolution) {
    return "Resolution is required";
  }

  if (trimmedResolution.length > 600) {
    return "Resolution must be 600 characters or fewer";
  }

  return null;
}

export function mapIncidentReportToAdminSummary(
  incidentReport: IncidentReport,
): AdminIncidentSummary {
  return {
    id: incidentReport.id,
    issueType: incidentReport.issueType,
    description: incidentReport.description,
    status: incidentReport.status,
    createdAt: incidentReport.createdAt,
    zoneName: incidentReport.spot?.zone.name ?? null,
    spotCode: incidentReport.spot?.spotCode ?? null,
    reporterName: incidentReport.user.name,
    resolution: incidentReport.resolution,
  };
}

export function AdminIncidentManagementPage() {
  const { user } = useAuthState();
  const [incidents, setIncidents] = useState<AdminIncidentSummary[]>([]);
  const [filter, setFilter] = useState<IncidentStatusFilter>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionIncidentId, setActionIncidentId] = useState<string | null>(null);
  const [pendingResolution, setPendingResolution] =
    useState<PendingIncidentResolution | null>(null);

  useEffect(() => {
    if (!canViewAdminIncidents(user)) {
      return;
    }

    let isMounted = true;

    async function loadIncidents() {
      setLoadStatus("loading");
      setLoadError(null);

      try {
        const response = await incidentReportsApi.listAdminReports();

        if (!isMounted) {
          return;
        }

        setIncidents(response.incidentReports.map(mapIncidentReportToAdminSummary));
        setLoadStatus("ready");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(getIncidentApiErrorMessage(error));
        setLoadStatus("error");
      }
    }

    void loadIncidents();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const visibleIncidents = useMemo(
    () => filterAdminIncidents(incidents, filter),
    [filter, incidents],
  );
  const openCount = incidents.filter((incident) => incident.status === "open").length;
  const inReviewCount = incidents.filter((incident) => incident.status === "inReview").length;
  const resolvedCount = incidents.filter((incident) => incident.status === "resolved").length;

  if (!canViewAdminIncidents(user)) {
    return (
      <section className="account-state account-state-error admin-state" aria-live="polite">
        <h2>Permission denied</h2>
        <p>This page is only available to administrator accounts.</p>
      </section>
    );
  }

  async function markIncidentInReview(incidentId: string) {
    setActionIncidentId(incidentId);
    setMessage(null);
    setActionError(null);

    try {
      const response = await incidentReportsApi.markInReview(incidentId);
      replaceIncident(response.incidentReport);
      setMessage("Incident marked in review.");
      setPendingResolution(null);
    } catch (error) {
      setActionError(getIncidentApiErrorMessage(error));
    } finally {
      setActionIncidentId(null);
    }
  }

  function openResolvePanel(incidentId: string) {
    setMessage(null);
    setPendingResolution({ incidentId, resolution: "", error: null });
  }

  async function confirmResolveIncident() {
    if (!pendingResolution) {
      return;
    }

    const validationError = validateResolution(pendingResolution.resolution);

    if (validationError) {
      setPendingResolution({ ...pendingResolution, error: validationError });
      return;
    }

    setActionIncidentId(pendingResolution.incidentId);
    setActionError(null);

    try {
      const response = await incidentReportsApi.resolveReport(pendingResolution.incidentId, {
        resolution: pendingResolution.resolution.trim(),
      });
      replaceIncident(response.incidentReport);
      setMessage("Incident resolved with administrator notes.");
      setPendingResolution(null);
    } catch (error) {
      setActionError(getIncidentApiErrorMessage(error));
    } finally {
      setActionIncidentId(null);
    }
  }

  function replaceIncident(incidentReport: IncidentReport) {
    const nextIncident = mapIncidentReportToAdminSummary(incidentReport);

    setIncidents((currentIncidents) =>
      currentIncidents.map((incident) =>
        incident.id === nextIncident.id ? nextIncident : incident,
      ),
    );
  }

  return (
    <section className="admin-incidents-page" aria-labelledby="admin-incidents-title">
      <header className="admin-incidents-header">
        <p className="eyebrow">Admin Operations</p>
        <h1 id="admin-incidents-title">Incident Management</h1>
        <p>Review driver reports, prioritise open issues, and record resolutions.</p>
      </header>

      <div className="incident-stat-grid" aria-label="Incident status summary">
        <IncidentStatCard label="Open Reports" value={openCount} />
        <IncidentStatCard label="In Review" value={inReviewCount} />
        <IncidentStatCard label="Resolved" value={resolvedCount} />
      </div>

      {message ? <p className="form-success incident-feedback">{message}</p> : null}
      {actionError ? (
        <p className="form-banner-error incident-feedback" role="alert">
          {actionError}
        </p>
      ) : null}

      {loadStatus === "error" && loadError ? (
        <p className="form-banner-error incident-feedback" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="admin-incidents-layout">
        <section className="incident-table-card" aria-labelledby="incident-table-title">
          <div className="incident-table-title">
            <div>
              <h2 id="incident-table-title">Recent Reports</h2>
              <p>
                {loadStatus === "loading"
                  ? "Loading incidents"
                  : `${visibleIncidents.length} incidents shown`}
              </p>
            </div>
            <label className="incident-filter">
              <span className="sr-only">Filter incidents by status</span>
              <select
                onChange={(event) => setFilter(event.target.value as IncidentStatusFilter)}
                value={filter}
              >
                {INCIDENT_STATUS_FILTERS.map((statusFilter) => (
                  <option key={statusFilter} value={statusFilter}>
                    {statusFilter === "all"
                      ? "All statuses"
                      : getIncidentStatusLabel(statusFilter)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loadStatus === "loading" ? (
            <section className="inventory-empty-inline" aria-live="polite">
              <h3>Loading incidents</h3>
              <p>Fetching the latest reports from the backend.</p>
            </section>
          ) : visibleIncidents.length === 0 ? (
            <section className="inventory-empty-inline" aria-live="polite">
              <h3>No incidents found</h3>
              <p>Reports matching this filter will appear here.</p>
            </section>
          ) : (
            <div className="incident-list" role="table" aria-label="Incident reports">
              <div className="incident-row incident-row-heading" role="row">
                <span role="columnheader">Issue</span>
                <span role="columnheader">Location</span>
                <span role="columnheader">Reporter</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Action</span>
              </div>
              {visibleIncidents.map((incident) => (
                <div className="incident-row" key={incident.id} role="row">
                  <span role="cell">
                    <strong>{getIncidentIssueTypeLabel(incident.issueType)}</strong>
                    <small>{incident.description}</small>
                  </span>
                  <span role="cell">
                    <strong>{incident.zoneName ?? "Campus wide"}</strong>
                    <small>{incident.spotCode ?? "No spot attached"}</small>
                  </span>
                  <span role="cell">
                    {incident.reporterName}
                    <small>{formatIncidentTime(incident.createdAt)}</small>
                  </span>
                  <span role="cell">
                    <span className={getIncidentStatusClass(incident.status)}>
                      {getIncidentStatusLabel(incident.status)}
                    </span>
                  </span>
                  <span className="incident-row-actions" role="cell">
                    {incident.status === "open" ? (
                      <button
                        className="secondary-button compact-button"
                        onClick={() => markIncidentInReview(incident.id)}
                        disabled={actionIncidentId === incident.id}
                        type="button"
                      >
                        {actionIncidentId === incident.id ? "Saving..." : "Mark Review"}
                      </button>
                    ) : null}
                    {incident.status !== "resolved" ? (
                      <button
                        className="primary-button compact-button"
                        onClick={() => openResolvePanel(incident.id)}
                        disabled={actionIncidentId === incident.id}
                        type="button"
                      >
                        Resolve
                      </button>
                    ) : (
                      <span className="incident-resolution-note">
                        {incident.resolution ?? "Resolved"}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="incident-review-panel" aria-label="Incident resolution panel">
          <h2>Resolution Notes</h2>
          {pendingResolution ? (
            <>
              <label
                className={
                  pendingResolution.error
                    ? "report-description-field report-description-field-error"
                    : "report-description-field"
                }
                htmlFor="incident-resolution"
              >
                <span className="form-label">Resolution</span>
                <textarea
                  aria-describedby={
                    pendingResolution.error ? "incident-resolution-error" : undefined
                  }
                  aria-invalid={Boolean(pendingResolution.error)}
                  id="incident-resolution"
                  maxLength={600}
                  onChange={(event) =>
                    setPendingResolution({
                      ...pendingResolution,
                      resolution: event.target.value,
                      error: null,
                    })
                  }
                  placeholder="Describe the action taken"
                  value={pendingResolution.resolution}
                />
                {pendingResolution.error ? (
                  <span className="form-error" id="incident-resolution-error">
                    {pendingResolution.error}
                  </span>
                ) : null}
              </label>
              <div className="incident-panel-actions">
                <button
                  className="primary-button"
                  disabled={actionIncidentId === pendingResolution.incidentId}
                  onClick={confirmResolveIncident}
                  type="button"
                >
                  {actionIncidentId === pendingResolution.incidentId
                    ? "Saving..."
                    : "Save Resolution"}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setPendingResolution(null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <p>
              Select Resolve on an open or in-review incident to record the administrator
              action. Resolved reports keep their notes visible in the table.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function IncidentStatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="parking-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatIncidentTime(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function getIncidentApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body;

    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  }

  if (error instanceof ApiResponseFormatError) {
    return error.message;
  }

  return "Incident request failed. Please try again.";
}
