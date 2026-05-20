import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, ApiResponseFormatError, createApiClient } from "../../services/apiClient.js";
import type { BookingSummary, BookingStatus } from "../../services/bookingsApi.js";
import { createBookingsApi } from "../../services/bookingsApi.js";

const sharedApiClient = createApiClient();

type MyBookingsStatus = "loading" | "ready" | "empty" | "error";

export function isBookingUpcoming(booking: BookingSummary, now = new Date()): boolean {
  return (
    (booking.status === "pending" || booking.status === "confirmed") &&
    new Date(booking.startTime).getTime() > now.getTime()
  );
}

export function isBookingCancellable(booking: BookingSummary, now = new Date()): boolean {
  return isBookingUpcoming(booking, now);
}

export function splitBookingsByTimeline(bookings: BookingSummary[], now = new Date()) {
  const upcoming: BookingSummary[] = [];
  const past: BookingSummary[] = [];

  for (const booking of bookings) {
    if (isBookingUpcoming(booking, now)) {
      upcoming.push(booking);
      continue;
    }

    past.push(booking);
  }

  return { upcoming, past };
}

export function getBookingStatusLabel(status: BookingStatus): string {
  const labelByStatus: Record<BookingStatus, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    expired: "Expired",
    completed: "Completed",
  };

  return labelByStatus[status];
}

export function getBookingStatusClass(status: BookingStatus): string {
  return `booking-status booking-status-${status}`;
}

export function getMyBookingsErrorMessage(error: unknown): string {
  if (error instanceof ApiResponseFormatError) {
    return "Booking routes are unavailable. Rebuild/restart backend and retry.";
  }

  if (error instanceof ApiError) {
    const body = error.body as { error?: string } | null;
    return body?.error ?? "Unable to load bookings.";
  }

  return "Unable to load bookings.";
}

function formatBookingDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatBookingTimeRange(startTime: string, endTime: string): string {
  const formatter = new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatter.format(new Date(startTime))}–${formatter.format(new Date(endTime))}`;
}

export function MyBookingsPage() {
  const bookingsApi = useMemo(() => createBookingsApi(sharedApiClient), []);
  const [status, setStatus] = useState<MyBookingsStatus>("loading");
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingSummary | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await bookingsApi.listMyBookings();
      setBookings(response.bookings);
      setStatus(response.bookings.length > 0 ? "ready" : "empty");
    } catch (error) {
      setStatus("error");
      setErrorMessage(getMyBookingsErrorMessage(error));
    }
  }, [bookingsApi]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const { upcoming, past } = splitBookingsByTimeline(bookings);

  const confirmCancellation = async () => {
    if (!cancelTarget) {
      return;
    }

    setCancelError(null);

    try {
      await bookingsApi.cancelBooking(cancelTarget.id);
      setCancelTarget(null);
      await loadBookings();
    } catch (error) {
      setCancelError(getMyBookingsErrorMessage(error));
    }
  };

  if (status === "loading") {
    return <section className="account-state account-state-loading"><h2>Loading bookings...</h2></section>;
  }

  if (status === "error") {
    return (
      <section className="account-state account-state-empty">
        <h2>Unable to load bookings</h2>
        <p>{errorMessage}</p>
        <button className="secondary-button" onClick={() => void loadBookings()} type="button">Retry</button>
      </section>
    );
  }

  if (status === "empty") {
    return (
      <section className="account-state account-state-empty">
        <h2>No bookings yet</h2>
        <p>Your current and past bookings will appear here.</p>
      </section>
    );
  }

  return (
    <section className="my-bookings-page" aria-labelledby="my-bookings-title">
      <h1 id="my-bookings-title">My Bookings</h1>
      <p className="my-bookings-subtitle">Manage current, expired, and cancelled bookings</p>
      <section className="my-bookings-table-panel">
        <h2>Current Bookings</h2>
        <table className="my-bookings-table">
          <thead>
            <tr>
              <th>Spot</th>
              <th>Zone</th>
              <th>Date</th>
              <th>Time</th>
              <th>Status</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {upcoming.map((booking) => (
              <tr key={booking.id}>
                <td>{booking.spot.spotCode}</td>
                <td>{booking.spot.zone.name}</td>
                <td>{formatBookingDate(booking.startTime)}</td>
                <td>{formatBookingTimeRange(booking.startTime, booking.endTime)}</td>
                <td><span className={getBookingStatusClass(booking.status)}>{getBookingStatusLabel(booking.status)}</span></td>
                <td>
                  {isBookingCancellable(booking) ? (
                    <button className="text-button booking-cancel-link" onClick={() => setCancelTarget(booking)} type="button">
                      Cancel
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {upcoming.length === 0 ? (
              <tr>
                <td colSpan={6}>No current or upcoming bookings.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      <section className="my-bookings-table-panel">
        <h2>Past Bookings</h2>
        <table className="my-bookings-table">
          <thead>
            <tr>
              <th>Spot</th>
              <th>Zone</th>
              <th>Date</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {past.map((booking) => (
              <tr key={booking.id}>
                <td>{booking.spot.spotCode}</td>
                <td>{booking.spot.zone.name}</td>
                <td>{formatBookingDate(booking.startTime)}</td>
                <td>{formatBookingTimeRange(booking.startTime, booking.endTime)}</td>
                <td><span className={getBookingStatusClass(booking.status)}>{getBookingStatusLabel(booking.status)}</span></td>
              </tr>
            ))}
            {past.length === 0 ? (
              <tr>
                <td colSpan={5}>No past bookings.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {cancelTarget ? (
        <aside className="booking-cancel-modal" aria-label="Cancel booking confirmation">
          <h3>Cancel Booking?</h3>
          <p>
            Are you sure you want to cancel booking {cancelTarget.spot.spotCode}? This action cannot be undone.
          </p>
          {cancelError ? <p className="form-error">{cancelError}</p> : null}
          <div className="booking-cancel-actions">
            <button className="secondary-button" onClick={() => setCancelTarget(null)} type="button">
              Keep Booking
            </button>
            <button className="danger-button" onClick={() => void confirmCancellation()} type="button">
              Cancel
            </button>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
