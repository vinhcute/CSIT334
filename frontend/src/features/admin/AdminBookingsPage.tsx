import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, ApiResponseFormatError, createApiClient } from "../../services/apiClient.js";
import { PaginationControls } from "../../components/PaginationControls.js";
import {
  createBookingsApi,
  type BookingDetail,
  type BookingFilters,
  type BookingStatus,
} from "../../services/bookingsApi.js";
import type { SafeUser } from "../auth/authTypes.js";
import { useAuthState } from "../auth/authState.js";
import { getBookingStatusClass, getBookingStatusLabel } from "../parking/MyBookingsPage.js";

const sharedApiClient = createApiClient();
const ADMIN_BOOKINGS_PAGE_SIZE = 20;

type AdminBookingsPageStatus = "loading" | "ready" | "empty" | "error";

interface AdminBookingFilterValues {
  status: "all" | BookingStatus;
  from: string;
  to: string;
  userSearch: string;
  zoneName: string;
}

export function canViewAdminBookings(user: SafeUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function createInitialAdminBookingFilters(): AdminBookingFilterValues {
  return {
    status: "all",
    from: "",
    to: "",
    userSearch: "",
    zoneName: "",
  };
}

export function buildAdminBookingsFilters(
  values: AdminBookingFilterValues,
  page: number,
): BookingFilters {
  const fromIso = values.from ? new Date(`${values.from}T00:00:00`).toISOString() : undefined;
  const toIso = values.to ? new Date(`${values.to}T23:59:59.999`).toISOString() : undefined;

  return {
    page,
    pageSize: ADMIN_BOOKINGS_PAGE_SIZE,
    status: values.status === "all" ? undefined : values.status,
    from: fromIso,
    to: toIso,
    userSearch: values.userSearch.trim() || undefined,
    zoneName: values.zoneName.trim() || undefined,
  };
}

export function getAdminBookingsErrorMessage(error: unknown): string {
  if (error instanceof ApiResponseFormatError) {
    return "Booking routes are unavailable. Rebuild/restart backend and retry.";
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

  return "Unable to load admin bookings. Please retry after checking the API server.";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function AdminBookingsPage() {
  const { user } = useAuthState();
  const bookingsApi = useMemo(() => createBookingsApi(sharedApiClient), []);
  const [status, setStatus] = useState<AdminBookingsPageStatus>("loading");
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [filters, setFilters] = useState<AdminBookingFilterValues>(createInitialAdminBookingFilters);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(
    async (appliedFilters: AdminBookingFilterValues) => {
      if (!canViewAdminBookings(user)) {
        return;
      }

      setStatus("loading");
      setError(null);

      try {
        const result = await bookingsApi.listAdminBookings(
          buildAdminBookingsFilters(appliedFilters, page),
        );
        setBookings(result.bookings);
        setTotalPages(result.pagination.totalPages);
        setStatus(result.bookings.length > 0 ? "ready" : "empty");
      } catch (requestError) {
        setStatus("error");
        setError(getAdminBookingsErrorMessage(requestError));
      }
    },
    [bookingsApi, page, user],
  );

  useEffect(() => {
    void loadBookings(filters);
  }, [filters, loadBookings]);

  if (!canViewAdminBookings(user)) {
    return (
      <section className="account-state account-state-error admin-state" aria-live="polite">
        <h2>Permission denied</h2>
        <p>Admin bookings are restricted to UniPark administrator accounts.</p>
      </section>
    );
  }

  return (
    <section className="admin-bookings-page" aria-labelledby="admin-bookings-title">
      <div className="account-header">
        <p className="eyebrow">Admin Booking Controls</p>
        <h2 id="admin-bookings-title">Bookings</h2>
        <p>Review all booking records by status, date range, user, and zone.</p>
      </div>

      <form
        className="admin-bookings-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void loadBookings(filters);
        }}
      >
        <label className="form-field">
          <span className="form-label">Status</span>
          <select
            aria-label="Filter by status"
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                status: event.target.value as AdminBookingFilterValues["status"],
              }));
              setPage(1);
            }}
            value={filters.status}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label className="form-field">
          <span className="form-label">From</span>
          <input
            aria-label="Filter from date"
            onChange={(event) => {
              setFilters((current) => ({ ...current, from: event.target.value }));
              setPage(1);
            }}
            type="date"
            value={filters.from}
          />
        </label>
        <label className="form-field">
          <span className="form-label">To</span>
          <input
            aria-label="Filter to date"
            onChange={(event) => {
              setFilters((current) => ({ ...current, to: event.target.value }));
              setPage(1);
            }}
            type="date"
            value={filters.to}
          />
        </label>
        <label className="form-field">
          <span className="form-label">Username or Email</span>
          <input
            aria-label="Filter by username or email"
            onChange={(event) => {
              setFilters((current) => ({ ...current, userSearch: event.target.value }));
              setPage(1);
            }}
            placeholder="e.g. Jake or jake@email.com"
            type="text"
            value={filters.userSearch}
          />
        </label>
        <label className="form-field">
          <span className="form-label">Zone name</span>
          <input
            aria-label="Filter by zone name"
            onChange={(event) => {
              setFilters((current) => ({ ...current, zoneName: event.target.value }));
              setPage(1);
            }}
            placeholder="e.g. North Lot"
            type="text"
            value={filters.zoneName}
          />
        </label>
      </form>

      {status === "loading" ? (
        <section className="account-state account-state-loading admin-state" aria-live="polite">
          <h2>Loading bookings...</h2>
          <span className="loading-ring" aria-hidden="true" />
        </section>
      ) : null}

      {status === "error" ? (
        <section className="account-state account-state-error admin-state" aria-live="polite">
          <h2>Unable to load bookings</h2>
          <p>{error}</p>
          <button className="primary-button" onClick={() => void loadBookings(filters)} type="button">
            Retry
          </button>
        </section>
      ) : null}

      {status === "empty" ? (
        <section className="account-state account-state-empty admin-state" aria-live="polite">
          <h2>No bookings found</h2>
          <p>No bookings matched the current filters.</p>
        </section>
      ) : null}

      {status === "ready" ? (
        <>
          <div className="admin-bookings-table" role="table" aria-label="Admin bookings">
          <div className="admin-bookings-row admin-bookings-row-heading" role="row">
            <span role="columnheader">Spot</span>
            <span role="columnheader">Zone</span>
            <span role="columnheader">User</span>
            <span role="columnheader">Start</span>
            <span role="columnheader">End</span>
            <span role="columnheader">Status</span>
          </div>
          {bookings.map((booking) => (
            <div className="admin-bookings-row" key={booking.id} role="row">
              <span role="cell">
                <strong>{booking.spot.spotCode}</strong>
              </span>
              <span role="cell">{booking.spot.zone.name}</span>
              <span role="cell">
                {booking.user?.name ?? "Unknown"}
                <small>{booking.user?.email ?? booking.userId}</small>
              </span>
              <span role="cell">{formatDateTime(booking.startTime)}</span>
              <span role="cell">{formatDateTime(booking.endTime)}</span>
              <span role="cell">
                <span className={getBookingStatusClass(booking.status)}>
                  {getBookingStatusLabel(booking.status)}
                </span>
              </span>
            </div>
          ))}
          </div>
          <PaginationControls
            currentPage={page}
            label="Admin bookings pagination"
            loading={false}
            onNext={() => setPage((current) => Math.min(current + 1, totalPages))}
            onPrevious={() => setPage((current) => Math.max(current - 1, 1))}
            totalPages={totalPages}
          />
        </>
      ) : null}
    </section>
  );
}
