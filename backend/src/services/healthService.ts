import { checkDatabaseConnection } from "../config/database.js";

export interface HealthResult {
  status: "ok" | "unhealthy";
  database: "reachable" | "unreachable";
}

export interface HealthChecker {
  checkHealth(): Promise<HealthResult>;
}

export class HealthService implements HealthChecker {
  async checkHealth(): Promise<HealthResult> {
    try {
      await checkDatabaseConnection();
      return {
        status: "ok",
        database: "reachable",
      };
    } catch {
      return {
        status: "unhealthy",
        database: "unreachable",
      };
    }
  }
}
