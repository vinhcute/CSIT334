import { describe, expect, it, vi } from "vitest";
import { createApiClient, type TokenStore } from "../src/services/apiClient.js";
import { createBookingsApi } from "../src/services/bookingsApi.js";

function createMemoryTokenStore(token = "bookings-token"): TokenStore {
  return {
    getToken: () => token,
    setToken: (nextToken) => {
      token = nextToken;
    },
    clearToken: () => {
      token = "";
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createTestClient(fetchImpl: typeof fetch) {
  return createApiClient({
    fetchImpl,
    tokenStore: createMemoryTokenStore(),
  });
}

function firstFetchCall(fetchImpl: typeof fetch): Parameters<typeof fetch> {
  return vi.mocked(fetchImpl).mock.calls[0] as unknown as Parameters<typeof fetch>;
}

function expectAuthHeader(fetchCall: Parameters<typeof fetch>) {
  const headers = fetchCall[1]?.headers as Headers;
  expect(headers.get("authorization")).toBe("Bearer bookings-token");
}

describe("bookings API client", () => {
  it("creates a booking with authenticated request", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ booking: { id: "booking-1" } }),
    ) as unknown as typeof fetch;
    const bookingsApi = createBookingsApi(createTestClient(fetchImpl));
    const input = {
      spotId: "spot-1",
      startTime: "2026-05-20T01:00:00.000Z",
      endTime: "2026-05-20T02:00:00.000Z",
    };

    await bookingsApi.createBooking(input);

    const fetchCall = firstFetchCall(fetchImpl);
    expect(fetchCall[0]).toBe("/api/bookings");
    expect(fetchCall[1]?.method).toBe("POST");
    expect(fetchCall[1]?.body).toBe(JSON.stringify(input));
    expectAuthHeader(fetchCall);
  });

  it("lists my bookings with authenticated request", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ bookings: [] }),
    ) as unknown as typeof fetch;
    const bookingsApi = createBookingsApi(createTestClient(fetchImpl));

    await bookingsApi.listMyBookings();

    const fetchCall = firstFetchCall(fetchImpl);
    expect(fetchCall[0]).toBe("/api/bookings/me");
    expect(fetchCall[1]?.method).toBe("GET");
    expectAuthHeader(fetchCall);
  });

  it("loads a booking detail with authenticated request", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ booking: { id: "booking-1" } }),
    ) as unknown as typeof fetch;
    const bookingsApi = createBookingsApi(createTestClient(fetchImpl));

    await bookingsApi.getBooking("booking-1");

    const fetchCall = firstFetchCall(fetchImpl);
    expect(fetchCall[0]).toBe("/api/bookings/booking-1");
    expect(fetchCall[1]?.method).toBe("GET");
    expectAuthHeader(fetchCall);
  });

  it("cancels a booking with authenticated request", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ booking: { id: "booking-1", status: "cancelled" } }),
    ) as unknown as typeof fetch;
    const bookingsApi = createBookingsApi(createTestClient(fetchImpl));

    await bookingsApi.cancelBooking("booking-1");

    const fetchCall = firstFetchCall(fetchImpl);
    expect(fetchCall[0]).toBe("/api/bookings/booking-1/cancel");
    expect(fetchCall[1]?.method).toBe("POST");
    expectAuthHeader(fetchCall);
  });

  it("lists admin bookings with query filters and authenticated request", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        bookings: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      }),
    ) as unknown as typeof fetch;
    const bookingsApi = createBookingsApi(createTestClient(fetchImpl));

    await bookingsApi.listAdminBookings({
      page: 1,
      pageSize: 20,
      status: "confirmed",
      from: "2026-05-20T00:00:00.000Z",
      to: "2026-05-21T00:00:00.000Z",
      userId: "user-1",
      zoneId: "zone-1",
      userSearch: "minh",
      zoneName: "North",
    });

    const fetchCall = firstFetchCall(fetchImpl);
    expect(fetchCall[0]).toBe(
      "/api/admin/bookings?status=confirmed&page=1&pageSize=20&from=2026-05-20T00%3A00%3A00.000Z&to=2026-05-21T00%3A00%3A00.000Z&userId=user-1&zoneId=zone-1&userSearch=minh&zoneName=North",
    );
    expect(fetchCall[1]?.method).toBe("GET");
    expectAuthHeader(fetchCall);
  });

  it("loads admin booking detail with authenticated request", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ booking: { id: "booking-1" } }),
    ) as unknown as typeof fetch;
    const bookingsApi = createBookingsApi(createTestClient(fetchImpl));

    await bookingsApi.getAdminBooking("booking-1");

    const fetchCall = firstFetchCall(fetchImpl);
    expect(fetchCall[0]).toBe("/api/admin/bookings/booking-1");
    expect(fetchCall[1]?.method).toBe("GET");
    expectAuthHeader(fetchCall);
  });
});
