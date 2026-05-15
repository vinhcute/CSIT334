import { z } from "zod";
import { ParkingSpotRepository } from "../repositories/parkingSpotRepository.js";
import { ParkingZoneRepository } from "../repositories/parkingZoneRepository.js";

const spotStatusSchema = z.enum(["available", "occupied", "reserved", "maintenanceRequired"], {
  error: "Parking spot status is invalid.",
});

const parkingSpotSchema = z.object({
  zoneId: z.string().trim().min(1, "Parking zone ID is required."),
  spotCode: z.string().trim().min(1, "Parking spot code is required."),
  status: spotStatusSchema.default("available"),
  level: z.string().trim().optional(),
  rowLabel: z.string().trim().optional(),
});

const updateParkingSpotSchema = parkingSpotSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one parking spot field is required.",
  });

export type CreateParkingSpotInput = z.input<typeof parkingSpotSchema>;
export type UpdateParkingSpotInput = z.input<typeof updateParkingSpotSchema>;

export interface ListParkingSpotInput {
  zoneId?: unknown;
  status?: unknown;
}

export class ParkingSpotValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Parking spot input is invalid.");
    this.name = "ParkingSpotValidationError";
  }
}

export class DuplicateParkingSpotCodeError extends Error {
  constructor() {
    super("A parking spot with this code already exists in this zone.");
    this.name = "DuplicateParkingSpotCodeError";
  }
}

export class ParkingSpotNotFoundError extends Error {
  constructor() {
    super("Parking spot not found.");
    this.name = "ParkingSpotNotFoundError";
  }
}

export class ParkingSpotZoneNotFoundError extends Error {
  constructor() {
    super("Parking zone not found.");
    this.name = "ParkingSpotZoneNotFoundError";
  }
}

export class ParkingSpotCapacityConflictError extends Error {
  constructor(zoneCapacity: number) {
    super(`Parking zone capacity of ${zoneCapacity} spots has already been reached.`);
    this.name = "ParkingSpotCapacityConflictError";
  }
}

export class ParkingSpotService {
  constructor(
    private readonly parkingSpotRepository = new ParkingSpotRepository(),
    private readonly parkingZoneRepository = new ParkingZoneRepository(),
  ) {}

  async listSpots(input: ListParkingSpotInput = {}) {
    const parsed = z
      .object({
        zoneId: z.string().trim().min(1, "Parking zone ID is required.").optional(),
        status: spotStatusSchema.optional(),
      })
      .safeParse(input);

    if (!parsed.success) {
      throw new ParkingSpotValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    if (parsed.data.zoneId) {
      await this.assertZoneExists(parsed.data.zoneId);
    }

    return this.parkingSpotRepository.list(parsed.data);
  }

  async findSpotById(id: string) {
    const spot = await this.parkingSpotRepository.findById(id);

    if (!spot) {
      throw new ParkingSpotNotFoundError();
    }

    return spot;
  }

  async createSpot(input: CreateParkingSpotInput) {
    const parsed = parkingSpotSchema.safeParse(input);

    if (!parsed.success) {
      throw new ParkingSpotValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    await this.assertZoneHasSpace(parsed.data.zoneId);
    await this.assertSpotCodeAvailable(parsed.data.zoneId, parsed.data.spotCode);

    return this.parkingSpotRepository.create(parsed.data);
  }

  async updateSpot(id: string, input: UpdateParkingSpotInput) {
    const parsed = updateParkingSpotSchema.safeParse(input);

    if (!parsed.success) {
      throw new ParkingSpotValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    const existing = await this.parkingSpotRepository.findById(id);

    if (!existing) {
      throw new ParkingSpotNotFoundError();
    }

    const nextZoneId = parsed.data.zoneId ?? existing.zoneId;
    const nextSpotCode = parsed.data.spotCode ?? existing.spotCode;

    if (parsed.data.zoneId && parsed.data.zoneId !== existing.zoneId) {
      await this.assertZoneHasSpace(parsed.data.zoneId);
    }

    if (nextZoneId !== existing.zoneId || nextSpotCode !== existing.spotCode) {
      await this.assertSpotCodeAvailable(nextZoneId, nextSpotCode);
    }

    return this.parkingSpotRepository.update(id, parsed.data);
  }

  async deleteSpot(id: string) {
    const existing = await this.parkingSpotRepository.findById(id);

    if (!existing) {
      throw new ParkingSpotNotFoundError();
    }

    return this.parkingSpotRepository.delete(id);
  }

  private async assertZoneExists(zoneId: string): Promise<void> {
    const zone = await this.parkingZoneRepository.findById(zoneId);

    if (!zone) {
      throw new ParkingSpotZoneNotFoundError();
    }
  }

  private async assertZoneHasSpace(zoneId: string): Promise<void> {
    const zone = await this.parkingZoneRepository.findById(zoneId);

    if (!zone) {
      throw new ParkingSpotZoneNotFoundError();
    }

    const existingSpotCount = await this.parkingSpotRepository.countByZoneId(zoneId);

    if (existingSpotCount >= zone.capacity) {
      throw new ParkingSpotCapacityConflictError(zone.capacity);
    }
  }

  private async assertSpotCodeAvailable(zoneId: string, spotCode: string): Promise<void> {
    const existing = await this.parkingSpotRepository.findByZoneIdAndSpotCode(
      zoneId,
      spotCode,
    );

    if (existing) {
      throw new DuplicateParkingSpotCodeError();
    }
  }
}
