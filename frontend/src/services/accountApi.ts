import type { CurrentUserResponse, VehicleProfile } from "../features/auth/authTypes.js";
import { createApiClient } from "./apiClient.js";

export interface UpdateProfileRequest {
  name: string;
  email: string;
  universityId: string;
}

export interface VehicleProfileRequest {
  licensePlate: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  isPrimary?: boolean;
}

export interface VehicleProfilesResponse {
  vehicleProfiles: VehicleProfile[];
}

export interface VehicleProfileResponse {
  vehicleProfile: VehicleProfile;
}

export type AccountApiClient = ReturnType<typeof createApiClient>;

export function createAccountApi(apiClient: AccountApiClient = createApiClient()) {
  return {
    getCurrentProfile(): Promise<CurrentUserResponse> {
      return apiClient.request<CurrentUserResponse>("/api/users/me", {
        authenticated: true,
      });
    },

    updateCurrentProfile(input: UpdateProfileRequest): Promise<CurrentUserResponse> {
      return apiClient.request<CurrentUserResponse>("/api/users/me", {
        method: "PATCH",
        body: input,
        authenticated: true,
      });
    },

    listMyVehicleProfiles(): Promise<VehicleProfilesResponse> {
      return apiClient.request<VehicleProfilesResponse>("/api/vehicle-profiles/me", {
        authenticated: true,
      });
    },

    createVehicleProfile(input: VehicleProfileRequest): Promise<VehicleProfileResponse> {
      return apiClient.request<VehicleProfileResponse>("/api/vehicle-profiles", {
        method: "POST",
        body: input,
        authenticated: true,
      });
    },

    updateVehicleProfile(
      vehicleProfileId: string,
      input: VehicleProfileRequest,
    ): Promise<VehicleProfileResponse> {
      return apiClient.request<VehicleProfileResponse>(
        `/api/vehicle-profiles/${vehicleProfileId}`,
        {
          method: "PATCH",
          body: input,
          authenticated: true,
        },
      );
    },
  };
}
