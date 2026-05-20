import type { Request, Response } from "express";
import {
  DuplicateParkingZoneNameError,
  DuplicateParkingZoneCodeError,
  ParkingZoneCapacityConflictError,
  ParkingZoneNotFoundError,
  ParkingZoneService,
  ParkingZoneValidationError,
} from "../services/parkingZoneService.js";

export class ParkingZoneController {
  constructor(private readonly parkingZoneService = new ParkingZoneService()) {}

  index = async (_request: Request, response: Response): Promise<void> => {
    const parkingZones = await this.parkingZoneService.listZones();
    response.json({ parkingZones });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    try {
      const parkingZone = await this.parkingZoneService.createZone(request.body);
      response.status(201).json({ parkingZone });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const parkingZoneId = request.params.id;

    if (typeof parkingZoneId !== "string") {
      response.status(400).json({ error: "Parking zone ID is required." });
      return;
    }

    try {
      const parkingZone = await this.parkingZoneService.updateZone(
        parkingZoneId,
        request.body,
      );
      response.json({ parkingZone });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const parkingZoneId = request.params.id;

    if (typeof parkingZoneId !== "string") {
      response.status(400).json({ error: "Parking zone ID is required." });
      return;
    }

    try {
      const parkingZone = await this.parkingZoneService.deleteZone(parkingZoneId);
      response.json({ parkingZone });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  private handleError(error: unknown, response: Response): void {
    if (error instanceof ParkingZoneValidationError) {
      response.status(400).json({ error: error.message, issues: error.issues });
      return;
    }

    if (error instanceof DuplicateParkingZoneNameError) {
      response.status(409).json({ error: error.message });
      return;
    }

    if (error instanceof DuplicateParkingZoneCodeError) {
      response.status(409).json({ error: error.message });
      return;
    }

    if (error instanceof ParkingZoneCapacityConflictError) {
      response.status(409).json({ error: error.message });
      return;
    }

    if (error instanceof ParkingZoneNotFoundError) {
      response.status(404).json({ error: error.message });
      return;
    }

    throw error;
  }
}
