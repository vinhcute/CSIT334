import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, ApiResponseFormatError, createApiClient } from "../../services/apiClient.js";
import {
  createIncidentReportsApi,
  type IncidentIssueType,
  type IncidentReportSummary,
  type IncidentStatus,
} from "../../services/incidentReportsApi.js";
import { createParkingSpotsApi, type ParkingSpot } from "../../services/parkingSpotsApi.js";
import { useAuthState } from "../auth/authState.js";
import type { SafeUser } from "../auth/authTypes.js";

const sharedApiClient = createApiClient();

const ISSUE_TYPE_OPTIONS: IncidentIssueType[] = [
  "spotDiscrepancy",
  "sensorFault",
  "paymentIssue",
  "safetyConcern",
  "other",
];

type ReportIssueStatus = "loading" | "ready" | "empty" | "error";

export function canViewReportIssue(user: SafeUser | null | undefined): boolean {
  return user?.role === "driver";
}

export function getIssueTypeLabel(issueType: IncidentIssueType): string {
  const labels: Record<IncidentIssueType, string> = {
    spotDiscrepancy: "Spot discrepancy",
    sensorFault: "Sensor fault",
    paymentIssue: "Payment issue",
    safetyConcern: "Safety concern",
    other: "Other",
  };

  return labels[issueType];
}

export function getIncidentStatusLabel(status: IncidentStatus): string {
  const labels: Record<IncidentStatus, string> = {
    open: "Open",
    inReview: "In review",
    resolved: "Resolved",
  };

  return labels[status];
}

export function getIncidentStatusClass(status: IncidentStatus): string {
  return `incident-status incident-status-${status}`;
}

export function getReportIssueErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { error?: string; issues?: string[] } | null;

    if (body?.issues?.length) {
      return body.issues.join(" ");
    }

    if (body?.error) {
      return body.error;
    }
  }

  if (error instanceof ApiResponseFormatError) {
    return "The incident API returned a non-JSON response. Rebuild and restart the backend server, then retry.";
  }

  return "Unable to load incident reporting data. Please check the API server and try again.";
}

export function getReportIssueValidationError(
  issueType: string,
  description: string,
): string | null {
  if (!ISSUE_TYPE_OPTIONS.includes(issueType as IncidentIssueType)) {
    return "Choose an issue type.";
  }

  const normalizedDescription = description.trim();

  if (normalizedDescription.length < 10) {
    return "Description must be at least 10 characters.";
  }

  if (normalizedDescription.length > 1000) {
    return "Description cannot exceed 1000 characters.";
  }

  return null;
}

function formatIncidentDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function ReportIssuePage() {
  const { user } = useAuthState();
  const incidentReportsApi = useMemo(() => createIncidentReportsApi(sharedApiClient), []);
  const parkingSpotsApi = useMemo(() => createParkingSpotsApi(sharedApiClient), []);
  const [status, setStatus] = useState<ReportIssueStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reports, setReports] = useState<IncidentReportSummary[]>([]);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [selectedSpotId, setSelectedSpotId] = useState("");
  const [selectedIssueType, setSelectedIssueType] = useState<IncidentIssueType>("spotDiscrepancy");
  const [description, setDescription] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const loadPage = useCallback(async () => {
    if (!canViewReportIssue(user)) {
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const [reportsResponse, spotsResponse] = await Promise.all([
        incidentReportsApi.listMyReports(),
        parkingSpotsApi.listSpots(),
      ]);

      setReports(reportsResponse.incidentReports);
      setSpots(spotsResponse.parkingSpots);
      setStatus(reportsResponse.incidentReports.length > 0 ? "ready" : "empty");
    } catch (error) {
      setStatus("error");
      setErrorMessage(getReportIssueErrorMessage(error));
    }
  }, [incidentReportsApi, parkingSpotsApi, user]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  if (!canViewReportIssue(user)) {
    return (
      <section className="account-state account-state-empty">
        <h2>Permission denied</h2>
        <p>This page is only available to driver accounts.</p>
      </section>
    );
  }

  const onSubmit = async () => {
    setSubmitErrorMessage(null);
    setSubmitSuccessMessage(null);
    const validationError = getReportIssueValidationError(selectedIssueType, description);

    if (validationError) {
      setValidationMessage(validationError);
      return;
    }

    setValidationMessage(null);
    setIsSubmitting(true);

    try {
      await incidentReportsApi.createReport({
        issueType: selectedIssueType,
        description: description.trim(),
        spotId: selectedSpotId || undefined,
      });

      setDescription("");
      setSelectedIssueType("spotDiscrepancy");
      setSelectedSpotId("");
      setSubmitSuccessMessage("Issue report submitted successfully.");
      await loadPage();
    } catch (error) {
      setSubmitErrorMessage(getReportIssueErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="report-issue-page" aria-labelledby="report-issue-title">
      <div className="report-issue-header">
        <div>
          <p className="eyebrow">Issue Reporting</p>
          <h1 id="report-issue-title">Report Parking Issue</h1>
          <p>Share spot or parking issues so the team can review and resolve them.</p>
        </div>
      </div>

      <section className="report-issue-panel" aria-label="Submit issue report">
        <h2>New report</h2>
        <div className="report-issue-form-grid">
          <label className="form-field">
            <span className="form-label">Issue Type</span>
            <select
              aria-label="Issue type"
              onChange={(event) =>
                setSelectedIssueType(event.target.value as IncidentIssueType)
              }
              value={selectedIssueType}
            >
              {ISSUE_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {getIssueTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-label">Spot (Optional)</span>
            <select
              aria-label="Spot"
              onChange={(event) => setSelectedSpotId(event.target.value)}
              value={selectedSpotId}
            >
              <option value="">General issue (no spot)</option>
              {spots.map((spot) => (
                <option key={spot.id} value={spot.id}>
                  {spot.spotCode}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field report-issue-description-field">
            <span className="form-label">Description</span>
            <textarea
              aria-label="Issue description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what happened, where, and any important details."
              rows={4}
              value={description}
            />
          </label>
        </div>

        {validationMessage ? <p className="form-error">{validationMessage}</p> : null}
        {submitErrorMessage ? <p className="form-banner-error">{submitErrorMessage}</p> : null}
        {submitSuccessMessage ? <p className="form-success">{submitSuccessMessage}</p> : null}

        <div className="report-issue-actions">
          <button className="primary-button" disabled={isSubmitting} onClick={() => void onSubmit()} type="button">
            {isSubmitting ? "Submitting..." : "Submit report"}
          </button>
        </div>
      </section>

      <section className="report-history-panel" aria-labelledby="report-history-title">
        <div className="report-history-heading">
          <h2 id="report-history-title">My recent reports</h2>
          <button className="secondary-button" onClick={() => void loadPage()} type="button">
            Refresh
          </button>
        </div>

        {status === "loading" ? <p className="analytics-muted">Loading report history...</p> : null}

        {status === "error" ? (
          <div className="account-state account-state-error">
            <h2>Unable to load reports</h2>
            <p>{errorMessage}</p>
            <button className="secondary-button" onClick={() => void loadPage()} type="button">
              Retry
            </button>
          </div>
        ) : null}

        {status === "empty" ? (
          <p className="analytics-muted">No reports submitted yet.</p>
        ) : null}

        {status === "ready" ? (
          <div className="report-history-list">
            {reports.map((report) => (
              <article className="report-history-row" key={report.id}>
                <div>
                  <strong>{getIssueTypeLabel(report.issueType)}</strong>
                  <span>{formatIncidentDate(report.createdAt)}</span>
                </div>
                <div>
                  <small>{report.spot ? `Spot ${report.spot.spotCode}` : "General issue"}</small>
                </div>
                <span className={getIncidentStatusClass(report.status)}>
                  {getIncidentStatusLabel(report.status)}
                </span>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}
