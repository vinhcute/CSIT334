import { describe, expect, it } from "vitest";
import type { SafeUser } from "../src/features/auth/authTypes.js";
import {
  canViewAdminUsers,
  getAccountActionForStatus,
  getAccountStatusClass,
  getSubscriptionDisplayText,
  userSummaryHasSensitiveFields,
} from "../src/features/admin/AdminUsersPage.js";

describe("admin users UI rules", () => {
  it("only allows admin users to view account management", () => {
    const admin: SafeUser = {
      id: "admin-1",
      email: "admin@example.test",
      role: "admin",
      accountStatus: "active",
    };
    const driver: SafeUser = {
      id: "driver-1",
      email: "driver@example.test",
      role: "driver",
      accountStatus: "active",
    };

    expect(canViewAdminUsers(admin)).toBe(true);
    expect(canViewAdminUsers(driver)).toBe(false);
  });

  it("uses a distinct disabled account status class", () => {
    expect(getAccountStatusClass("disabled")).toContain("status-badge-disabled");
  });

  it("uses disable for active accounts and reactivate for disabled accounts", () => {
    expect(getAccountActionForStatus("active")).toBe("disable");
    expect(getAccountActionForStatus("disabled")).toBe("reactivate");
  });

  it("flags password hashes as sensitive UI fields", () => {
    expect(userSummaryHasSensitiveFields({ id: "user-1", passwordHash: "secret" })).toBe(
      true,
    );
    expect(userSummaryHasSensitiveFields({ id: "user-1", email: "driver@example.test" })).toBe(
      false,
    );
  });

  it("formats subscription state for admin account rows", () => {
    expect(
      getSubscriptionDisplayText({
        id: "user-1",
        email: "driver@example.test",
        role: "driver",
        accountStatus: "active",
        subscription: {
          status: "subscribed",
          endTime: "2026-05-24T00:00:00.000Z",
        },
      }),
    ).toContain("Subscribed until");
    expect(
      getSubscriptionDisplayText({
        id: "user-2",
        email: "driver2@example.test",
        role: "driver",
        accountStatus: "active",
        subscription: {
          status: "notSubscribed",
          endTime: null,
        },
      }),
    ).toBe("Not subscribed");
  });
});
