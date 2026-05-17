import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  AdminAnalyticsPage,
  getAverageOccupancy,
  getPeakHour,
  getUtilisationStatus,
  getUtilisationStatusLabel,
  seedOccupancyTrend,
} from "../src/features/admin/AdminAnalyticsPage.js";

describe("admin analytics UI rules", () => {
  it("exports an admin analytics page", () => {
    const element = createElement(AdminAnalyticsPage);

    expect(element.type).toBe(AdminAnalyticsPage);
  });

  it("calculates peak hour and average occupancy from trend points", () => {
    expect(getPeakHour(seedOccupancyTrend)?.label).toBe("14:00");
    expect(getAverageOccupancy(seedOccupancyTrend)).toBe(65);
  });

  it("maps utilisation rates to readable status labels", () => {
    expect(getUtilisationStatus(54)).toBe("open");
    expect(getUtilisationStatus(76)).toBe("busy");
    expect(getUtilisationStatus(82)).toBe("critical");
    expect(getUtilisationStatusLabel("critical")).toBe("Critical");
  });
});
