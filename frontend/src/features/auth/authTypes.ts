export type UserRole = "driver" | "admin";

export type AccountStatus = "active" | "disabled" | "pending";

export interface VehicleProfile {
  id: string;
  userId: string;
  licensePlate: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SafeUser {
  id: string;
  name?: string;
  email: string;
  universityId?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt?: string;
  updatedAt?: string;
  vehicleProfiles?: VehicleProfile[];
}

export interface RegisterDriverRequest {
  name: string;
  universityId: string;
  email: string;
  password: string;
  licensePlate: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterResponse {
  user: SafeUser;
}

export interface LoginResponse {
  token: string;
  user: SafeUser;
}

export interface LogoutResponse {
  success: true;
  strategy: "clientTokenDiscard";
}

export interface CurrentUserResponse {
  user: SafeUser;
}
