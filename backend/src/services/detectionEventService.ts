import { type Prisma, SpotStatus } from "@prisma/client";
import { z } from "zod";
import { parkingEvents } from "../realtime/parkingEvents.js";
import { DetectionEventRepository } from "../repositories/detectionEventRepository.js";
import { ParkingSpotRepository } from "../repositories/parkingSpotRepository.js";
import { OccupancyService } from "./occupancyService.js";

const detectionEventSchema = z.object({
  spotId: z.string().trim().min(1, "Parking spot ID is required."),
  type: z.enum(["vehicleEntry", "vehicleExit"], {
    error: "Detection event type is invalid.",
  }),
  occurredAt: z.coerce.date().optional(),
  rawPayload: z.unknown().optional(),
});

export type IngestDetectionEventInput = z.input<typeof detectionEventSchema>;

export class DetectionEventValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Detection event input is invalid.");
    this.name = "DetectionEventValidationError";
  }
}

export class DetectionEventSpotNotFoundError extends Error {
  constructor() {
    super("Parking spot not found.");
    this.name = "DetectionEventSpotNotFoundError";
  }
}

export class DetectionEventReservedSpotConflictError extends Error {
  constructor() {
    super("Reserved parking spots cannot be changed by detection events.");
    this.name = "DetectionEventReservedSpotConflictError";
  }
}

export class DetectionEventService {
  constructor(
    private readonly detectionEventRepository = new DetectionEventRepository(),
    private readonly parkingSpotRepository = new ParkingSpotRepository(),
    private readonly occupancyService = new OccupancyService(),
  ) {}

  async listRecentDetectionEvents() {
    return this.detectionEventRepository.listRecent();
  }

  async ingestDetectionEvent(input: IngestDetectionEventInput) {
    const parsed = detectionEventSchema.safeParse(input);

    if (!parsed.success) {
      throw new DetectionEventValidationError(
        parsed.error.issues.map((issue) => issue.message),
      );
    }

    const parkingSpot = await this.parkingSpotRepository.findById(parsed.data.spotId);

    if (!parkingSpot) {
      throw new DetectionEventSpotNotFoundError();
    }

    if (parkingSpot.status === SpotStatus.reserved) {
      throw new DetectionEventReservedSpotConflictError();
    }

    const nextStatus =
      parsed.data.type === "vehicleEntry" ? SpotStatus.occupied : SpotStatus.available;

    const result = await this.detectionEventRepository.createAndUpdateSpotStatus(
      {
        spotId: parsed.data.spotId,
        type: parsed.data.type,
        occurredAt: parsed.data.occurredAt,
        rawPayload: parsed.data.rawPayload as Prisma.InputJsonValue | undefined,
      },
      nextStatus,
    );

    const zoneSummary = await this.occupancyService.getZoneDetail(result.parkingSpot.zoneId);
    parkingEvents.broadcastParkingUpdate({
      spotId: result.parkingSpot.id,
      zoneId: result.parkingSpot.zoneId,
      status: result.parkingSpot.status,
      zoneSummary,
    });

    return result;
  }
}
