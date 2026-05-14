import type { Request, Response } from "express";
import { HealthService, type HealthChecker } from "../services/healthService.js";

export class HealthController {
  constructor(private readonly healthService: HealthChecker = new HealthService()) {}

  show = async (_request: Request, response: Response): Promise<void> => {
    const result = await this.healthService.checkHealth();
    const statusCode = result.status === "ok" ? 200 : 503;

    response.status(statusCode).json(result);
  };
}
