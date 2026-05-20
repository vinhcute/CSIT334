import type { Request, Response } from "express";
import {
  DuplicateLicensePlateError,
  VehicleProfileNotFoundError,
  VehicleProfileService,
  VehicleProfileValidationError,
} from "../services/vehicleProfileService.js";

export class VehicleProfileController {
  constructor(private readonly vehicleProfileService = new VehicleProfileService()) {}

  listMine = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    const vehicleProfiles = await this.vehicleProfileService.listMine(request.user.userId);
    response.json({ vehicleProfiles });
  };

  createMine = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const vehicleProfile = await this.vehicleProfileService.createMine(
        request.user.userId,
        request.body,
      );
      response.status(201).json({ vehicleProfile });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  updateMine = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    const vehicleProfileId = request.params.id;

    if (typeof vehicleProfileId !== "string") {
      response.status(400).json({ error: "Vehicle profile ID is required." });
      return;
    }

    try {
      const vehicleProfile = await this.vehicleProfileService.updateMine(
        request.user.userId,
        vehicleProfileId,
        request.body,
      );
      response.json({ vehicleProfile });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  private handleError(error: unknown, response: Response): void {
    if (error instanceof VehicleProfileValidationError) {
      response.status(400).json({ error: error.message, issues: error.issues });
      return;
    }

    if (error instanceof DuplicateLicensePlateError) {
      response.status(409).json({ error: error.message });
      return;
    }

    if (error instanceof VehicleProfileNotFoundError) {
      response.status(404).json({ error: error.message });
      return;
    }

    throw error;
  }
}
