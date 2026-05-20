import { describe, expect, it } from "vitest";
import {
  hasAuthErrors,
  validateLogin,
  validateRegistration,
} from "../src/features/auth/authValidation.js";

describe("auth form validation", () => {
  it("returns required-field errors for registration", () => {
    const errors = validateRegistration({
      name: "",
      universityId: "",
      email: "",
      password: "",
      licensePlate: "",
    });

    expect(errors.name).toBe("Name is required.");
    expect(errors.universityId).toBe("University ID is required.");
    expect(errors.email).toBe("Email is required.");
    expect(errors.password).toBe("Password is required.");
    expect(errors.licensePlate).toBe("Licence plate is required.");
    expect(hasAuthErrors(errors)).toBe(true);
  });

  it("returns invalid email and short password errors for registration", () => {
    const errors = validateRegistration({
      name: "Test Driver",
      universityId: "UOW001",
      email: "not-an-email",
      password: "short",
      licensePlate: "ABC-123",
    });

    expect(errors.email).toBe("Enter a valid email address.");
    expect(errors.password).toBe("Password must be at least 8 characters.");
  });

  it("accepts valid login input", () => {
    const errors = validateLogin({
      email: "driver@example.test",
      password: "password-value",
    });

    expect(hasAuthErrors(errors)).toBe(false);
  });
});
