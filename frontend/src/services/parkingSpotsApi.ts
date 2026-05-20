import { createApiClient } from "./apiClient.js";

export type ParkingSpotStatus =
  | "available"
  | "occupied"
  | "reserved"
  | "maintenanceRequired";

export interface ParkingSpot {
  id: string;
  zoneId: string;
  spotCode: string;
  status: ParkingSpotStatus;
  level: string | null;
  rowLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParkingSpotsResponse {
  parkingSpots: ParkingSpot[];
  pagination?: ParkingSpotsPagination;
}

export interface ParkingSpotsPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ParkingSpotResponse {
  parkingSpot: ParkingSpot;
}

export interface ParkingSpotFilters {
  zoneId?: string;
  status?: ParkingSpotStatus;
  page?: number;
  pageSize?: number;
}

export interface ParkingSpotRequest {
  zoneId?: string;
  spotCode?: string;
  status?: ParkingSpotStatus;
  level?: string | null;
  rowLabel?: string | null;
}

export interface NextParkingSpotCodeResponse {
  spotCode: string;
}

export interface BulkSpotLevelUpdateRequest {
  zoneId: string;
  level: string;
  spotIds?: string[];
  range?: {
    from: number;
    to: number;
  };
}

export interface BulkSpotLevelUpdateResponse {
  zoneId: string;
  level: string;
  updatedCount: number;
}

export async function listAllParkingSpots(
  fetchPage: (filters: ParkingSpotFilters) => Promise<ParkingSpotsResponse>,
  filters: Omit<ParkingSpotFilters, "page" | "pageSize"> = {},
): Promise<ParkingSpot[]> {
  const firstPage = await fetchPage({ ...filters, page: 1 });
  const firstPageSpots = firstPage.parkingSpots;
  const totalPages = firstPage.pagination?.totalPages ?? 1;

  if (totalPages <= 1) {
    return firstPageSpots;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, pageIndex) =>
      fetchPage({ ...filters, page: pageIndex + 2 }),
    ),
  );

  return [
    ...firstPageSpots,
    ...remainingPages.flatMap((pageResponse) => pageResponse.parkingSpots),
  ];
}

export type ParkingSpotsApiClient = ReturnType<typeof createApiClient>;

export function createParkingSpotsApi(
  apiClient: ParkingSpotsApiClient = createApiClient(),
) {
  return {
    listSpots(filters: ParkingSpotFilters = {}): Promise<ParkingSpotsResponse> {
      return apiClient.request<ParkingSpotsResponse>(buildParkingSpotsPath(filters), {
        authenticated: true,
      });
    },

    listAllSpots(
      filters: Omit<ParkingSpotFilters, "page" | "pageSize"> = {},
    ): Promise<ParkingSpot[]> {
      return listAllParkingSpots((pageFilters) => this.listSpots(pageFilters), filters);
    },

    listSpotsForZone(
      zoneId: string,
      filters: Pick<ParkingSpotFilters, "status"> = {},
    ): Promise<ParkingSpotsResponse> {
      const searchParams = new URLSearchParams();

      if (filters.status) {
        searchParams.set("status", filters.status);
      }

      const query = searchParams.toString();

      return apiClient.request<ParkingSpotsResponse>(
        `/api/parking-zones/${zoneId}/parking-spots${query ? `?${query}` : ""}`,
        {
          authenticated: true,
        },
      );
    },

    createSpot(input: ParkingSpotRequest): Promise<ParkingSpotResponse> {
      return apiClient.request<ParkingSpotResponse>("/api/admin/parking-spots", {
        method: "POST",
        body: input,
        authenticated: true,
      });
    },

    getNextSpotCode(zoneId: string): Promise<NextParkingSpotCodeResponse> {
      return apiClient.request<NextParkingSpotCodeResponse>(
        `/api/admin/parking-zones/${zoneId}/next-spot-code`,
        {
          authenticated: true,
        },
      );
    },

    updateSpot(spotId: string, input: ParkingSpotRequest): Promise<ParkingSpotResponse> {
      return apiClient.request<ParkingSpotResponse>(
        `/api/admin/parking-spots/${spotId}`,
        {
          method: "PATCH",
          body: input,
          authenticated: true,
        },
      );
    },

    deleteSpot(spotId: string): Promise<ParkingSpotResponse> {
      return apiClient.request<ParkingSpotResponse>(
        `/api/admin/parking-spots/${spotId}`,
        {
          method: "DELETE",
          authenticated: true,
        },
      );
    },

    bulkUpdateLevel(input: BulkSpotLevelUpdateRequest): Promise<BulkSpotLevelUpdateResponse> {
      return apiClient.request<BulkSpotLevelUpdateResponse>(
        "/api/admin/parking-spots/bulk-level",
        {
          method: "PATCH",
          body: input,
          authenticated: true,
        },
      );
    },
  };
}

function buildParkingSpotsPath(filters: ParkingSpotFilters): string {
  const searchParams = new URLSearchParams();

  if (filters.zoneId) {
    searchParams.set("zoneId", filters.zoneId);
  }

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  if (filters.page) {
    searchParams.set("page", String(filters.page));
  }

  if (filters.pageSize) {
    searchParams.set("pageSize", String(filters.pageSize));
  }

  const query = searchParams.toString();

  return `/api/parking-spots${query ? `?${query}` : ""}`;
}
