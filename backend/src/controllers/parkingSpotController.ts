import type { Request, Response } from "express";
import {
  DuplicateParkingSpotCodeError,
  ParkingSpotCapacityConflictError,
  ParkingSpotNotFoundError,
  ParkingSpotRangeConflictError,
  ParkingSpotService,
  ParkingSpotValidationError,
  ParkingSpotZoneNotFoundError,
} from "../services/parkingSpotService.js";

export class ParkingSpotController {
  constructor(private readonly parkingSpotService = new ParkingSpotService()) {}

  index = async (request: Request, response: Response): Promise<void> => {
    try {
      const result = await this.parkingSpotService.listSpotsPaginated({
        zoneId: request.query.zoneId,
        status: request.query.status,
        page: request.query.page,
        pageSize: request.query.pageSize,
      });
      response.json(result);
    } catch (error) {
      this.handleError(error, response);
    }
  };

  indexForZone = async (request: Request, response: Response): Promise<void> => {
    try {
      const parkingSpots = await this.parkingSpotService.listSpots({
        zoneId: request.params.zoneId,
        status: request.query.status,
      });
      response.json({ parkingSpots });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  nextSpotCode = async (request: Request, response: Response): Promise<void> => {
    const parkingZoneId = request.params.zoneId;

    if (typeof parkingZoneId !== "string") {
      response.status(400).json({ error: "Parking zone ID is required." });
      return;
    }

    try {
      const spotCode = await this.parkingSpotService.getNextSpotCodeForZone(parkingZoneId);
      response.json({ spotCode });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  create = async (request: Request, response: Response): Promise<void> => {
    try {
      const parkingSpot = await this.parkingSpotService.createSpot(request.body);
      response.status(201).json({ parkingSpot });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const parkingSpotId = request.params.id;

    if (typeof parkingSpotId !== "string") {
      response.status(400).json({ error: "Parking spot ID is required." });
      return;
    }

    try {
      const parkingSpot = await this.parkingSpotService.updateSpot(
        parkingSpotId,
        request.body,
      );
      response.json({ parkingSpot });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const parkingSpotId = request.params.id;

    if (typeof parkingSpotId !== "string") {
      response.status(400).json({ error: "Parking spot ID is required." });
      return;
    }

    try {
      const parkingSpot = await this.parkingSpotService.deleteSpot(parkingSpotId);
      response.json({ parkingSpot });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  bulkLevelUpdate = async (request: Request, response: Response): Promise<void> => {
    try {
      const result = await this.parkingSpotService.bulkUpdateSpotLevel(request.body);
      response.json(result);
    } catch (error) {
      this.handleError(error, response);
    }
  };

  private handleError(error: unknown, response: Response): void {
    if (error instanceof ParkingSpotValidationError) {
      response.status(400).json({ error: error.message, issues: error.issues });
      return;
    }

    if (error instanceof DuplicateParkingSpotCodeError) {
      response.status(409).json({ error: error.message });
      return;
    }

    if (error instanceof ParkingSpotCapacityConflictError) {
      response.status(409).json({ error: error.message });
      return;
    }

    if (error instanceof ParkingSpotRangeConflictError) {
      response.status(409).json({ error: error.message });
      return;
    }

    if (
      error instanceof ParkingSpotNotFoundError ||
      error instanceof ParkingSpotZoneNotFoundError
    ) {
      response.status(404).json({ error: error.message });
      return;
    }

    throw error;
  }
}
