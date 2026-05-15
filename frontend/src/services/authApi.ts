import type {
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  RegisterDriverRequest,
  RegisterResponse,
} from "../features/auth/authTypes.js";
import { createApiClient } from "./apiClient.js";

export type ApiClient = ReturnType<typeof createApiClient>;

export function createAuthApi(apiClient: ApiClient = createApiClient()) {
  return {
    async register(input: RegisterDriverRequest): Promise<RegisterResponse> {
      return apiClient.request<RegisterResponse>("/api/auth/register", {
        method: "POST",
        body: input,
      });
    },

    async login(input: LoginRequest): Promise<LoginResponse> {
      const result = await apiClient.request<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: input,
      });

      apiClient.setAuthToken(result.token);

      return result;
    },

    async logout(): Promise<LogoutResponse> {
      try {
        return await apiClient.request<LogoutResponse>("/api/auth/logout", {
          method: "POST",
          authenticated: true,
        });
      } finally {
        apiClient.clearAuthToken();
      }
    },

    async getCurrentUser(): Promise<CurrentUserResponse> {
      return apiClient.request<CurrentUserResponse>("/api/users/me", {
        authenticated: true,
      });
    },
  };
}
