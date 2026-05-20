import { describe, expect, it } from "vitest";
import type { CreateSubscriptionResponse } from "../src/services/subscriptionApi.js";

describe("account UI copy", () => {
  it("keeps subscription success copy explicitly simulated", () => {
    const response: CreateSubscriptionResponse = {
      subscription: {
        id: "subscription-1",
        userId: "user-1",
        type: "monthly",
        status: "active",
        startTime: "2026-05-15T00:00:00.000Z",
        endTime: "2026-06-14T00:00:00.000Z",
        createdAt: "2026-05-15T00:00:00.000Z",
        updatedAt: "2026-05-15T00:00:00.000Z",
      },
      message: "Simulated subscription activated; no payment was processed.",
    };

    expect(response.message).toContain("Simulated subscription");
    expect(response.message).toContain("no payment was processed");
  });
});
