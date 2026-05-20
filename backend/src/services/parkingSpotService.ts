import { z } from "zod";
import { ParkingSpotRepository } from "../repositories/parkingSpotRepository.js";
import { ParkingZoneRepository } from "../repositories/parkingZoneRepository.js";

const spotStatusSchema = z.enum(["available", "occupied", "reserved", "maintenanceRequired"], {
  error: "Parking spot status is invalid.",
});

const parkingSpotSchema = z.object({
  zoneId: z.string().trim().min(1, "Parking zone ID is required."),
  spotCode: z.string().trim().min(1, "Parking spot code is required.").optional(),
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
  page?: unknown;
  pageSize?: unknown;
}

export interface BulkUpdateParkingSpotLevelInput {
  zoneId?: unknown;
  level?: unknown;
  spotIds?: unknown;
  range?: unknown;
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

export class ParkingSpotRangeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParkingSpotRangeConflictError";
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
        page: z.coerce
          .number()
          .int("Page must be a whole number.")
          .min(1, "Page must be at least 1.")
          .optional(),
        pageSize: z.coerce
          .number()
          .int("Page size must be a whole number.")
          .min(1, "Page size must be at least 1.")
          .max(100, "Page size cannot exceed 100.")
          .optional(),
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

  async listSpotsPaginated(input: ListParkingSpotInput = {}) {
    const parsed = z
      .object({
        zoneId: z.string().trim().min(1, "Parking zone ID is required.").optional(),
        status: spotStatusSchema.optional(),
        page: z.coerce
          .number()
          .int("Page must be a whole number.")
          .min(1, "Page must be at least 1.")
          .default(1),
        pageSize: z.coerce
          .number()
          .int("Page size must be a whole number.")
          .min(1, "Page size must be at least 1.")
          .max(100, "Page size cannot exceed 100.")
          .default(20),
      })
      .safeParse(input);

    if (!parsed.success) {
      throw new ParkingSpotValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    if (parsed.data.zoneId) {
      await this.assertZoneExists(parsed.data.zoneId);
    }

    return this.parkingSpotRepository.listPaginated(parsed.data);
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

    const spotCode = parsed.data.spotCode ?? (await this.getNextSpotCodeForZone(parsed.data.zoneId));

    await this.assertZoneHasSpace(parsed.data.zoneId);
    await this.assertSpotCodeAvailable(parsed.data.zoneId, spotCode);

    return this.parkingSpotRepository.create({
      ...parsed.data,
      spotCode,
    });
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

  async getNextSpotCodeForZone(zoneId: string) {
    const zone = await this.parkingZoneRepository.findById(zoneId);

    if (!zone) {
      throw new ParkingSpotZoneNotFoundError();
    }

    const spotCodes = await this.parkingSpotRepository.listSpotCodesByZoneId(zoneId);
    const prefix = `${zone.zoneCode}-`;
    const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
    const highestSequence = spotCodes.reduce((highest, spot) => {
      const match = pattern.exec(spot.spotCode);

      if (!match) {
        return highest;
      }

      return Math.max(highest, Number(match[1]));
    }, 0);

    return `${prefix}${String(highestSequence + 1).padStart(3, "0")}`;
  }

  async deleteSpot(id: string) {
    const existing = await this.parkingSpotRepository.findById(id);

    if (!existing) {
      throw new ParkingSpotNotFoundError();
    }

    return this.parkingSpotRepository.delete(id);
  }

  async bulkUpdateSpotLevel(input: BulkUpdateParkingSpotLevelInput) {
    const parsed = z
      .object({
        zoneId: z.string().trim().min(1, "Parking zone ID is required."),
        level: z
          .string()
          .trim()
          .min(1, "Level is required.")
          .max(50, "Level cannot exceed 50 characters."),
        spotIds: z
          .array(z.string().trim().min(1, "Parking spot ID is required."))
          .min(1, "Choose at least one parking spot.")
          .optional(),
        range: z
          .object({
            from: z.coerce
              .number()
              .int("Range start must be a whole number.")
              .min(1, "Range start must be at least 1."),
            to: z.coerce
              .number()
              .int("Range end must be a whole number.")
              .min(1, "Range end must be at least 1."),
          })
          .optional(),
      })
      .safeParse(input);

    if (!parsed.success) {
      throw new ParkingSpotValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    if (parsed.data.range && parsed.data.spotIds) {
      throw new ParkingSpotValidationError([
        "Choose only one targeting mode: all spots, spot IDs, or range.",
      ]);
    }

    if (parsed.data.range) {
      const rangeSize = parsed.data.range.to - parsed.data.range.from + 1;

      if (parsed.data.range.from > parsed.data.range.to) {
        throw new ParkingSpotValidationError([
          "Range start must be less than or equal to range end.",
        ]);
      }

      if (rangeSize > 500) {
        throw new ParkingSpotValidationError([
          "Range cannot exceed 500 spots.",
        ]);
      }
    }

    await this.assertZoneExists(parsed.data.zoneId);

    if (parsed.data.range) {
      const zone = await this.parkingZoneRepository.findById(parsed.data.zoneId);

      if (!zone) {
        throw new ParkingSpotZoneNotFoundError();
      }

      const expectedSpotCodes = generateSpotCodesForRange(
        zone.zoneCode,
        parsed.data.range.from,
        parsed.data.range.to,
      );
      const existingSpots = await this.parkingSpotRepository.listByZoneIdAndSpotCodes(
        parsed.data.zoneId,
        expectedSpotCodes,
      );
      const existingSpotCodeSet = new Set(existingSpots.map((spot) => spot.spotCode));
      const missingSpotCodes = expectedSpotCodes.filter((spotCode) => !existingSpotCodeSet.has(spotCode));

      if (missingSpotCodes.length > 0) {
        throw new ParkingSpotRangeConflictError(
          `Requested range includes missing spot codes: ${missingSpotCodes.join(", ")}.`,
        );
      }

      const updatedCount = await this.parkingSpotRepository.updateLevelByZoneIdAndSpotCodes(
        parsed.data.zoneId,
        expectedSpotCodes,
        parsed.data.level,
      );

      return {
        zoneId: parsed.data.zoneId,
        level: parsed.data.level,
        updatedCount,
        mode: "range" as const,
        range: parsed.data.range,
      };
    }

    if (parsed.data.spotIds) {
      const matchingCount = await this.parkingSpotRepository.countByZoneIdAndSpotIds(
        parsed.data.zoneId,
        parsed.data.spotIds,
      );

      if (matchingCount !== parsed.data.spotIds.length) {
        throw new ParkingSpotValidationError([
          "All selected spots must belong to the selected zone.",
        ]);
      }

      const updatedCount = await this.parkingSpotRepository.updateLevelByZoneIdAndSpotIds(
        parsed.data.zoneId,
        parsed.data.spotIds,
        parsed.data.level,
      );

      return {
        zoneId: parsed.data.zoneId,
        level: parsed.data.level,
        updatedCount,
        mode: "spotIds" as const,
      };
    }

    const updatedCount = await this.parkingSpotRepository.updateLevelByZoneId(
      parsed.data.zoneId,
      parsed.data.level,
    );

    return {
      zoneId: parsed.data.zoneId,
      level: parsed.data.level,
      updatedCount,
      mode: "all" as const,
    };
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generateSpotCodesForRange(zoneCode: string, from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => {
    const spotNumber = from + index;

    return `${zoneCode}-${String(spotNumber).padStart(3, "0")}`;
  });
}
