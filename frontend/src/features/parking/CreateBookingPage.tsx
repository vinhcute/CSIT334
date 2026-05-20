import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, ApiResponseFormatError, createApiClient } from "../../services/apiClient.js";
import { createAccountApi } from "../../services/accountApi.js";
import { createBookingsApi } from "../../services/bookingsApi.js";
import { createOccupancyApi } from "../../services/occupancyApi.js";
import { createParkingSpotsApi, type ParkingSpot } from "../../services/parkingSpotsApi.js";
import { getParkingMapStatusClass, getParkingMapStatusText } from "./ParkingMapPage.js";

const sharedApiClient = createApiClient();

type CreateBookingStatus = "loading" | "ready" | "submitting" | "success" | "error";

export interface CreateBookingValidationResult {
  startTime?: string;
  endTime?: string;
  spotId?: string;
  vehicleProfileId?: string;
}

export function validateCreateBookingInput(input: {
  spotId: string | null;
  vehicleProfileId: string | null;
  startTime: string;
  endTime: string;
  now?: Date;
}): CreateBookingValidationResult {
  const issues: CreateBookingValidationResult = {};
  const now = input.now ?? new Date();

  if (!input.spotId) {
    issues.spotId = "Please select a parking spot.";
  }

  if (!input.vehicleProfileId) {
    issues.vehicleProfileId = "Vehicle plate is required.";
  }

  if (!input.startTime) {
    issues.startTime = "Start time is required.";
  }

  if (!input.endTime) {
    issues.endTime = "End time is required.";
  }

  const start = input.startTime ? new Date(input.startTime) : null;
  const end = input.endTime ? new Date(input.endTime) : null;

  if (start && !Number.isNaN(start.getTime()) && start.getTime() <= now.getTime()) {
    issues.startTime = "Start time must be in the future.";
  }

  if (
    start &&
    end &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end.getTime() <= start.getTime()
  ) {
    issues.endTime = "End time must be after start time.";
  }

  return issues;
}

export function getCreateBookingErrorMessage(error: unknown): string {
  if (error instanceof ApiResponseFormatError) {
    return "Booking API route is unavailable. Rebuild/restart backend and retry.";
  }

  if (error instanceof ApiError) {
    const body = error.body as { error?: string } | null;

    if (error.status === 403) {
      return (
        body?.error ??
        "Booking requires an active permit. Please activate your subscription and try again."
      );
    }

    if (error.status === 409) {
      return body?.error ?? "This booking conflicts with the current spot status.";
    }

    if (body?.error) {
      return body.error;
    }
  }

  return "Unable to create booking. Please try again.";
}

export function toDateTimeLocalInputValue(value: Date): string {
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function CreateBookingPage({
  onBackToMap,
  onOpenMyBookings,
  selectedSpotId,
}: {
  onBackToMap: () => void;
  onOpenMyBookings: () => void;
  selectedSpotId: string | null;
}) {
  const bookingsApi = useMemo(() => createBookingsApi(sharedApiClient), []);
  const accountApi = useMemo(() => createAccountApi(sharedApiClient), []);
  const parkingSpotsApi = useMemo(() => createParkingSpotsApi(sharedApiClient), []);
  const occupancyApi = useMemo(() => createOccupancyApi(sharedApiClient), []);
  const [status, setStatus] = useState<CreateBookingStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validation, setValidation] = useState<CreateBookingValidationResult>({});
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [zoneName, setZoneName] = useState<string | null>(null);
  const [vehicleProfiles, setVehicleProfiles] = useState<
    Array<{ id: string; licensePlate: string; isPrimary: boolean }>
  >([]);
  const [selectedVehicleProfileId, setSelectedVehicleProfileId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(toDateTimeLocalInputValue(new Date(Date.now() + 3600000)));
  const [endTime, setEndTime] = useState(toDateTimeLocalInputValue(new Date(Date.now() + 7200000)));

  const loadSpot = useCallback(async () => {
    if (!selectedSpotId) {
      setStatus("error");
      setErrorMessage("No parking spot was selected.");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const [spotsResponse, summaryResponse] = await Promise.all([
        parkingSpotsApi.listSpots(),
        occupancyApi.getSummary(),
      ]);
      const vehiclesResponse = await accountApi.listMyVehicleProfiles();
      const spot = spotsResponse.parkingSpots.find((candidate) => candidate.id === selectedSpotId) ?? null;

      if (!spot) {
        setStatus("error");
        setErrorMessage("Selected parking spot could not be found.");
        return;
      }

      setSelectedSpot(spot);
      setZoneName(
        summaryResponse.summary.zones.find((zone) => zone.zoneId === spot.zoneId)?.name ?? spot.zoneId,
      );
      const sortedVehicles = [...vehiclesResponse.vehicleProfiles]
        .sort((first, second) => Number(second.isPrimary) - Number(first.isPrimary))
        .map((vehicle) => ({
          id: vehicle.id,
          licensePlate: vehicle.licensePlate,
          isPrimary: vehicle.isPrimary,
        }));
      setVehicleProfiles(sortedVehicles);
      setSelectedVehicleProfileId(sortedVehicles[0]?.id ?? null);
      setStatus("ready");
    } catch {
      setStatus("error");
      setErrorMessage("Unable to load booking details. Please retry.");
    }
  }, [accountApi, occupancyApi, parkingSpotsApi, selectedSpotId]);

  useEffect(() => {
    void loadSpot();
  }, [loadSpot]);

  const submitBooking = async () => {
    const issues = validateCreateBookingInput({
      spotId: selectedSpot?.id ?? null,
      vehicleProfileId: selectedVehicleProfileId,
      startTime,
      endTime,
    });

    if (Object.keys(issues).length > 0) {
      setValidation(issues);
      return;
    }

    if (selectedSpot?.status !== "available") {
      setErrorMessage("This parking spot is no longer available for booking.");
      return;
    }

    setValidation({});
    setErrorMessage(null);
    setStatus("submitting");

    try {
      await bookingsApi.createBooking({
        spotId: selectedSpot.id,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
      setStatus("success");
    } catch (error) {
      setStatus("ready");
      setErrorMessage(getCreateBookingErrorMessage(error));
    }
  };

  if (status === "loading") {
    return <section className="account-state account-state-loading"><h2>Loading booking form...</h2></section>;
  }

  if (status === "error") {
    return (
      <section className="account-state account-state-empty">
        <h2>Unable to load booking details</h2>
        <p>{errorMessage}</p>
        <button className="secondary-button" onClick={onBackToMap} type="button">Back to Parking Map</button>
      </section>
    );
  }

  if (status === "success") {
    return (
      <section className="create-booking-page">
        <h1>Create Booking</h1>
        <p className="form-success">Booking confirmed successfully.</p>
        <div className="create-booking-actions">
          <button className="secondary-button" onClick={onBackToMap} type="button">Back to Parking Map</button>
          <button className="primary-button" onClick={onOpenMyBookings} type="button">Open My Bookings</button>
        </div>
      </section>
    );
  }

  return (
    <section className="create-booking-page" aria-labelledby="create-booking-title">
      <h1 id="create-booking-title">Create Booking</h1>
      {selectedSpot ? (
        <article className="selected-booking-spot">
          <p className="eyebrow">Selected Spot</p>
          <h2>{zoneName} • Spot {selectedSpot.spotCode}</h2>
          <span className={getParkingMapStatusClass(selectedSpot.status)}>
            {getParkingMapStatusText(selectedSpot.status)}
          </span>
        </article>
      ) : null}
      {errorMessage ? <p className="form-banner-error">{errorMessage}</p> : null}
      {vehicleProfiles.length === 0 ? (
        <p className="form-banner-error">
          No vehicle profile found. Please add a vehicle before creating a booking.
        </p>
      ) : null}
      <div className="create-booking-grid">
        <label className={validation.vehicleProfileId ? "form-field form-field-error" : "form-field"}>
          <span className="form-label">Vehicle plate</span>
          <select
            onChange={(event) => setSelectedVehicleProfileId(event.target.value)}
            value={selectedVehicleProfileId ?? ""}
          >
            {vehicleProfiles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.licensePlate}
                {vehicle.isPrimary ? " (Primary)" : ""}
              </option>
            ))}
          </select>
          {validation.vehicleProfileId ? (
            <span className="form-error">{validation.vehicleProfileId}</span>
          ) : null}
        </label>
        <label className={validation.startTime ? "form-field form-field-error" : "form-field"}>
          <span className="form-label">Start time</span>
          <input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          {validation.startTime ? <span className="form-error">{validation.startTime}</span> : null}
        </label>
        <label className={validation.endTime ? "form-field form-field-error" : "form-field"}>
          <span className="form-label">End time</span>
          <input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          {validation.endTime ? <span className="form-error">{validation.endTime}</span> : null}
        </label>
      </div>
      <div className="create-booking-actions">
        <button className="secondary-button" onClick={onBackToMap} type="button">Back to Parking Map</button>
        <button
          className="primary-button"
          disabled={status === "submitting" || vehicleProfiles.length === 0}
          onClick={() => void submitBooking()}
          type="button"
        >
          {status === "submitting" ? "Creating..." : "Confirm Booking"}
        </button>
      </div>
    </section>
  );
}
