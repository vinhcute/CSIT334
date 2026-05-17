import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, ApiResponseFormatError } from "../../services/apiClient.js";
import {
  createParkingSpotsApi,
  type ParkingSpot,
} from "../../services/parkingSpotsApi.js";
import {
  createIncidentReportsApi,
  type IncidentIssueType,
} from "../../services/incidentReportsApi.js";
import {
  createParkingZonesApi,
  type ParkingZone,
} from "../../services/parkingZonesApi.js";

export const REPORT_ISSUE_TYPES = [
  { value: "spotDiscrepancy", label: "Spot discrepancy" },
  { value: "parkingIssue", label: "Parking issue" },
  { value: "safetyConcern", label: "Safety concern" },
  { value: "accessibilityIssue", label: "Accessibility issue" },
] as const;

export interface ReportIssueFormValues {
  issueType: string;
  zoneId: string;
  spotId: string;
  description: string;
}

export type ReportIssueErrors = Partial<Record<keyof ReportIssueFormValues, string>>;

interface ReportIssueViewModel {
  zones: ParkingZone[];
  spots: ParkingSpot[];
}

const initialFormValues: ReportIssueFormValues = {
  issueType: "",
  zoneId: "",
  spotId: "",
  description: "",
};

const parkingZonesApi = createParkingZonesApi();
const parkingSpotsApi = createParkingSpotsApi();
const incidentReportsApi = createIncidentReportsApi();

export function ReportIssuePage() {
  const [viewModel, setViewModel] = useState<ReportIssueViewModel>({
    zones: [],
    spots: [],
  });
  const [formValues, setFormValues] = useState<ReportIssueFormValues>(initialFormValues);
  const [errors, setErrors] = useState<ReportIssueErrors>({});
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "submitting" | "submitted" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadParkingInventory() {
      setLoadStatus("loading");
      setLoadError(null);

      try {
        const [zonesResponse, spotsResponse] = await Promise.all([
          parkingZonesApi.listZones(),
          parkingSpotsApi.listSpots(),
        ]);

        if (!isMounted) {
          return;
        }

        setViewModel({
          zones: zonesResponse.parkingZones,
          spots: spotsResponse.parkingSpots,
        });
        setLoadStatus("ready");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(getReportIssueDataErrorMessage(error));
        setLoadStatus("error");
      }
    }

    void loadParkingInventory();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSpots = useMemo(
    () => filterReportIssueSpots(viewModel.spots, formValues.zoneId),
    [formValues.zoneId, viewModel.spots],
  );
  const selectedSpot = viewModel.spots.find((spot) => spot.id === formValues.spotId);
  const selectedZone = viewModel.zones.find((zone) => zone.id === formValues.zoneId);

  function updateField(field: keyof ReportIssueFormValues, value: string) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
      ...(field === "zoneId" ? { spotId: "" } : {}),
    }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitStatus("idle");
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateReportIssueForm(formValues);
    setErrors(nextErrors);
    setSubmitError(null);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitStatus("idle");
      return;
    }

    setSubmitStatus("submitting");

    try {
      await incidentReportsApi.createReport({
        issueType: formValues.issueType as IncidentIssueType,
        description: formValues.description.trim(),
        ...(formValues.spotId ? { spotId: formValues.spotId } : {}),
      });
      setFormValues(initialFormValues);
      setSubmitStatus("submitted");
    } catch (error) {
      setSubmitError(getReportIssueSubmitErrorMessage(error));
      setSubmitStatus("error");
    }
  }

  if (loadStatus === "loading") {
    return (
      <section className="report-state report-state-loading" aria-live="polite">
        <h2>Loading report form</h2>
        <p>Checking the latest parking zones and spots.</p>
        <span className="loading-ring" aria-hidden="true" />
      </section>
    );
  }

  if (loadStatus === "error") {
    return (
      <section className="report-state report-state-error" aria-live="polite">
        <h2>Unable to load report form</h2>
        <p>{loadError}</p>
        <button
          className="primary-button"
          onClick={() => window.location.reload()}
          type="button"
        >
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className="report-issue-page" aria-labelledby="report-issue-title">
      <header className="report-issue-header">
        <p className="eyebrow">Driver Support</p>
        <h1 id="report-issue-title">Report Issue</h1>
        <p>Submit parking spot discrepancies, safety concerns, or accessibility issues.</p>
      </header>

      <div className="report-issue-layout">
        <form className="report-issue-card" onSubmit={handleSubmit} noValidate>
          <div className="panel-heading">
            <h2>Issue Details</h2>
            <p>Select the affected location when it applies.</p>
          </div>

          {submitStatus === "submitted" ? (
            <p className="form-success" role="status">
              Issue report submitted.
            </p>
          ) : null}
          {submitStatus === "error" && submitError ? (
            <p className="form-banner-error" role="alert">
              {submitError}
            </p>
          ) : null}

          <label
            className={errors.issueType ? "form-field form-field-error" : "form-field"}
            htmlFor="issue-type"
          >
            <span className="form-label">Issue Type</span>
            <select
              aria-describedby={errors.issueType ? "issue-type-error" : undefined}
              aria-invalid={Boolean(errors.issueType)}
              id="issue-type"
              onChange={(event) => updateField("issueType", event.target.value)}
              value={formValues.issueType}
            >
              <option value="">Select issue type</option>
              {REPORT_ISSUE_TYPES.map((issueType) => (
                <option key={issueType.value} value={issueType.value}>
                  {issueType.label}
                </option>
              ))}
            </select>
            {errors.issueType ? (
              <span className="form-error" id="issue-type-error">
                {errors.issueType}
              </span>
            ) : null}
          </label>

          <div className="report-location-grid">
            <label className="form-field" htmlFor="report-zone">
              <span className="form-label">Parking Zone</span>
              <select
                id="report-zone"
                onChange={(event) => updateField("zoneId", event.target.value)}
                value={formValues.zoneId}
              >
                <option value="">No zone selected</option>
                {viewModel.zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field" htmlFor="report-spot">
              <span className="form-label">Parking Spot</span>
              <select
                disabled={filteredSpots.length === 0}
                id="report-spot"
                onChange={(event) => updateField("spotId", event.target.value)}
                value={formValues.spotId}
              >
                <option value="">No spot selected</option>
                {filteredSpots.map((spot) => (
                  <option key={spot.id} value={spot.id}>
                    {spot.spotCode}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label
            className={
              errors.description
                ? "report-description-field report-description-field-error"
                : "report-description-field"
            }
            htmlFor="report-description"
          >
            <span className="form-label">Description</span>
            <textarea
              aria-describedby={errors.description ? "report-description-error" : undefined}
              aria-invalid={Boolean(errors.description)}
              id="report-description"
              maxLength={1000}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Describe what happened"
              value={formValues.description}
            />
            {errors.description ? (
              <span className="form-error" id="report-description-error">
                {errors.description}
              </span>
            ) : null}
          </label>

          <button
            className="primary-button report-submit-button"
            disabled={submitStatus === "submitting"}
            type="submit"
          >
            {submitStatus === "submitting" ? "Submitting..." : "Submit Report"}
          </button>
        </form>

        <aside className="report-summary-card" aria-label="Selected report context">
          <h2>Selected Location</h2>
          <dl className="selected-spot-list">
            <div>
              <dt>Zone</dt>
              <dd>{selectedZone?.name ?? "Not selected"}</dd>
            </div>
            <div>
              <dt>Spot</dt>
              <dd>{selectedSpot?.spotCode ?? "Not selected"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selectedSpot ? getReportIssueSpotStatusText(selectedSpot.status) : "N/A"}</dd>
            </div>
          </dl>
          <p>
            Reports are reviewed by parking administrators and affected spots can be
            marked for maintenance when needed.
          </p>
        </aside>
      </div>
    </section>
  );
}

export function validateReportIssueForm(values: ReportIssueFormValues): ReportIssueErrors {
  const errors: ReportIssueErrors = {};

  if (!values.issueType) {
    errors.issueType = "Issue type is required";
  }

  const description = values.description.trim();

  if (!description) {
    errors.description = "Description is required";
  } else if (description.length > 1000) {
    errors.description = "Description must be 1000 characters or fewer";
  }

  return errors;
}

export function filterReportIssueSpots(spots: ParkingSpot[], zoneId: string): ParkingSpot[] {
  if (!zoneId) {
    return spots;
  }

  return spots.filter((spot) => spot.zoneId === zoneId);
}

export function getReportIssueSpotStatusText(status: ParkingSpot["status"]): string {
  const statusLabels: Record<ParkingSpot["status"], string> = {
    available: "Available",
    occupied: "Occupied",
    reserved: "Reserved",
    maintenanceRequired: "Maintenance",
  };

  return statusLabels[status];
}

export function getReportIssueDataErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body;

    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  }

  if (error instanceof ApiResponseFormatError) {
    return error.message;
  }

  return "Unable to load parking locations. Please try again.";
}

export function getReportIssueSubmitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body;

    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  }

  if (error instanceof ApiResponseFormatError) {
    return error.message;
  }

  return "Unable to submit the issue report. Please try again.";
}
