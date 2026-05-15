import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, ApiResponseFormatError, createApiClient } from "../../services/apiClient.js";
import {
  createDetectionEventsApi,
  type DetectionEvent,
  type DetectionEventType,
  type IngestDetectionEventRequest,
} from "../../services/detectionEventsApi.js";
import {
  createParkingSpotsApi,
  type ParkingSpot,
  type ParkingSpotStatus,
} from "../../services/parkingSpotsApi.js";
import { useAuthState } from "../auth/authState.js";
import type { SafeUser } from "../auth/authTypes.js";

const sharedApiClient = createApiClient();

type SensorPageStatus = "loading" | "ready" | "empty" | "error";

export const DETECTION_EVENT_TYPE_OPTIONS: DetectionEventType[] = [
  "vehicleEntry",
  "vehicleExit",
];

export interface SensorEventFormValues {
  spotId: string;
  type: string;
}

export interface SensorEventFormErrors {
  spotId?: string;
  type?: string;
}

export function canViewAdminSensorEvents(user: SafeUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function isDetectionEventType(value: string): value is DetectionEventType {
  return DETECTION_EVENT_TYPE_OPTIONS.includes(value as DetectionEventType);
}

export function getDetectionEventTypeText(type: DetectionEventType): string {
  const textByType: Record<DetectionEventType, string> = {
    vehicleEntry: "Vehicle Entry",
    vehicleExit: "Vehicle Exit",
  };

  return textByType[type];
}

export function getDetectionEventResultStatus(type: DetectionEventType): ParkingSpotStatus {
  return type === "vehicleEntry" ? "occupied" : "available";
}

export function createEmptySensorEventFormValues(defaultSpotId = ""): SensorEventFormValues {
  return {
    spotId: defaultSpotId,
    type: "vehicleEntry",
  };
}

export function validateSensorEventForm(
  values: SensorEventFormValues,
  spots: Pick<ParkingSpot, "id">[],
): SensorEventFormErrors {
  const errors: SensorEventFormErrors = {};

  if (!spots.some((spot) => spot.id === values.spotId)) {
    errors.spotId = "Choose an existing parking spot";
  }

  if (!isDetectionEventType(values.type)) {
    errors.type = "Choose a valid sensor event";
  }

  return errors;
}

export function sensorEventFormHasErrors(errors: SensorEventFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function toIngestDetectionEventRequest(
  values: SensorEventFormValues,
): IngestDetectionEventRequest {
  return {
    spotId: values.spotId,
    type: isDetectionEventType(values.type) ? values.type : "vehicleEntry",
    rawPayload: {
      source: "admin-simulator",
    },
  };
}

export function getSensorEventErrorMessage(error: unknown): string {
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
    return "The sensor API returned a non-JSON response. Rebuild and restart the backend server, then retry.";
  }

  return "Unable to process the simulated sensor event. Please check the API server and try again.";
}

export function getParkingSpotStatusText(status: ParkingSpotStatus): string {
  const statusTextByStatus: Record<ParkingSpotStatus, string> = {
    available: "Available",
    occupied: "Occupied",
    reserved: "Reserved",
    maintenanceRequired: "Maintenance",
  };

  return statusTextByStatus[status];
}

export function getParkingSpotStatusClass(status: ParkingSpotStatus): string {
  return `parking-status parking-status-${status}`;
}

export function formatSensorEventTime(occurredAt: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(occurredAt));
}

export function AdminSensorEventsPage() {
  const { user } = useAuthState();
  const detectionEventsApi = useMemo(
    () => createDetectionEventsApi(sharedApiClient),
    [],
  );
  const parkingSpotsApi = useMemo(() => createParkingSpotsApi(sharedApiClient), []);
  const [status, setStatus] = useState<SensorPageStatus>("loading");
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [formValues, setFormValues] = useState<SensorEventFormValues>(
    createEmptySensorEventFormValues(),
  );
  const [formErrors, setFormErrors] = useState<SensorEventFormErrors>({});
  const [updatedSpot, setUpdatedSpot] = useState<ParkingSpot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSensorData = useCallback(async () => {
    if (!canViewAdminSensorEvents(user)) {
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const [spotsResponse, eventsResponse] = await Promise.all([
        parkingSpotsApi.listSpots(),
        detectionEventsApi.listRecentDetectionEvents(),
      ]);

      setSpots(spotsResponse.parkingSpots);
      setEvents(eventsResponse.detectionEvents);
      setFormValues((currentValues) => ({
        ...currentValues,
        spotId: currentValues.spotId || spotsResponse.parkingSpots[0]?.id || "",
      }));
      setStatus(spotsResponse.parkingSpots.length > 0 ? "ready" : "empty");
    } catch (loadError) {
      setStatus("error");
      setError(getSensorEventErrorMessage(loadError));
    }
  }, [detectionEventsApi, parkingSpotsApi, user]);

  useEffect(() => {
    void loadSensorData();
  }, [loadSensorData]);

  async function submitSensorEvent() {
    const nextErrors = validateSensorEventForm(formValues, spots);

    setFormErrors(nextErrors);
    setMessage(null);
    setError(null);

    if (sensorEventFormHasErrors(nextErrors)) {
      return;
    }

    try {
      const result = await detectionEventsApi.ingestDetectionEvent(
        toIngestDetectionEventRequest(formValues),
      );

      setUpdatedSpot(result.parkingSpot);
      setEvents((currentEvents) => [result.detectionEvent, ...currentEvents].slice(0, 10));
      setSpots((currentSpots) =>
        currentSpots.map((spot) =>
          spot.id === result.parkingSpot.id ? result.parkingSpot : spot,
        ),
      );
      setMessage(
        `${result.parkingSpot.spotCode} updated to ${getParkingSpotStatusText(result.parkingSpot.status)}.`,
      );
    } catch (submitError) {
      setError(getSensorEventErrorMessage(submitError));
    }
  }

  if (!canViewAdminSensorEvents(user)) {
    return (
      <section className="sensor-state sensor-state-permission" aria-live="polite">
        <h2>Permission denied</h2>
        <p>This simulator is only available to administrator accounts.</p>
      </section>
    );
  }

  if (status === "loading") {
    return (
      <section className="sensor-state sensor-state-loading" aria-live="polite">
        <h2>Loading sensor controls...</h2>
        <span className="loading-ring" aria-hidden="true" />
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="sensor-state sensor-state-error" aria-live="polite">
        <h2>Unable to load sensor controls</h2>
        <p>{error}</p>
        <button className="primary-button" onClick={() => void loadSensorData()} type="button">
          Retry
        </button>
      </section>
    );
  }

  if (status === "empty") {
    return (
      <section className="sensor-state sensor-state-empty" aria-live="polite">
        <h2>No parking spots available</h2>
        <p>Create parking spots before posting simulated sensor events.</p>
      </section>
    );
  }

  const spotNameById = new Map(spots.map((spot) => [spot.id, spot.spotCode]));

  return (
    <section className="sensor-events-page" aria-labelledby="sensor-events-title">
      <div className="sensor-events-header">
        <h1 id="sensor-events-title">Simulated Sensor Events</h1>
        <p>Post controlled vehicle entry and exit events for local demo verification.</p>
      </div>

      {message ? <p className="form-success sensor-feedback">{message}</p> : null}
      {error ? <p className="form-banner-error sensor-feedback">{error}</p> : null}

      <div className="sensor-events-grid">
        <section className="sensor-panel" aria-labelledby="sensor-form-title">
          <h2 id="sensor-form-title">Post Sensor Event</h2>
          <label
            className={formErrors.spotId ? "form-field form-field-error" : "form-field"}
            htmlFor="sensorSpot"
          >
            <span className="form-label">Parking Spot</span>
            <select
              aria-describedby={formErrors.spotId ? "sensorSpot-error" : undefined}
              aria-invalid={Boolean(formErrors.spotId)}
              id="sensorSpot"
              onChange={(event) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  spotId: event.target.value,
                }))
              }
              value={formValues.spotId}
            >
              {spots.map((spot) => (
                <option key={spot.id} value={spot.id}>
                  {spot.spotCode} - {getParkingSpotStatusText(spot.status)}
                </option>
              ))}
            </select>
            {formErrors.spotId ? (
              <span className="form-error" id="sensorSpot-error">
                {formErrors.spotId}
              </span>
            ) : null}
          </label>

          <label
            className={formErrors.type ? "form-field form-field-error" : "form-field"}
            htmlFor="sensorType"
          >
            <span className="form-label">Event Type</span>
            <select
              aria-describedby={formErrors.type ? "sensorType-error" : undefined}
              aria-invalid={Boolean(formErrors.type)}
              id="sensorType"
              onChange={(event) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  type: event.target.value,
                }))
              }
              value={formValues.type}
            >
              {DETECTION_EVENT_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {getDetectionEventTypeText(type)} - sets spot to{" "}
                  {getParkingSpotStatusText(getDetectionEventResultStatus(type))}
                </option>
              ))}
            </select>
            {formErrors.type ? (
              <span className="form-error" id="sensorType-error">
                {formErrors.type}
              </span>
            ) : null}
          </label>

          <button className="primary-button" onClick={() => void submitSensorEvent()} type="button">
            Post Event
          </button>
        </section>

        <section className="sensor-panel" aria-labelledby="sensor-result-title">
          <h2 id="sensor-result-title">Updated Spot</h2>
          {updatedSpot ? (
            <div className="sensor-updated-spot">
              <strong>{updatedSpot.spotCode}</strong>
              <span className={getParkingSpotStatusClass(updatedSpot.status)}>
                {getParkingSpotStatusText(updatedSpot.status)}
              </span>
            </div>
          ) : (
            <p className="sensor-muted">Submit a simulated event to see the updated status.</p>
          )}
        </section>
      </div>

      <section className="sensor-feed-panel" aria-labelledby="sensor-feed-title">
        <h2 id="sensor-feed-title">Recent Detection Events</h2>
        {events.length === 0 ? (
          <p className="sensor-muted">No detection events have been recorded yet.</p>
        ) : (
          <div className="sensor-feed-list">
            {events.map((event) => (
              <article className="sensor-feed-row" key={event.id}>
                <span>{formatSensorEventTime(event.occurredAt)}</span>
                <strong>{spotNameById.get(event.spotId) ?? event.spotId}</strong>
                <span>{getDetectionEventTypeText(event.type)}</span>
                <span className={getParkingSpotStatusClass(getDetectionEventResultStatus(event.type))}>
                  {getParkingSpotStatusText(getDetectionEventResultStatus(event.type))}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
