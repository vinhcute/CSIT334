import type { LoginRequest, RegisterDriverRequest } from "./authTypes.js";

export const MIN_AUTH_PASSWORD_LENGTH = 8;

export type AuthFormErrors<T extends string> = Partial<Record<T, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(input: LoginRequest): AuthFormErrors<keyof LoginRequest> {
  const errors: AuthFormErrors<keyof LoginRequest> = {};

  if (!input.email.trim()) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(input.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!input.password) {
    errors.password = "Password is required.";
  }

  return errors;
}

export function validateRegistration(
  input: RegisterDriverRequest,
): AuthFormErrors<keyof RegisterDriverRequest> {
  const errors: AuthFormErrors<keyof RegisterDriverRequest> = {};

  if (!input.name.trim()) {
    errors.name = "Name is required.";
  }

  if (!input.universityId.trim()) {
    errors.universityId = "University ID is required.";
  }

  if (!input.email.trim()) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(input.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!input.password) {
    errors.password = "Password is required.";
  } else if (input.password.length < MIN_AUTH_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_AUTH_PASSWORD_LENGTH} characters.`;
  }

  if (!input.licensePlate.trim()) {
    errors.licensePlate = "Licence plate is required.";
  }

  return errors;
}

export function hasAuthErrors(errors: AuthFormErrors<string>): boolean {
  return Object.values(errors).some(Boolean);
}
