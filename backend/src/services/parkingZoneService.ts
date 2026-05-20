import { z } from "zod";
import { ParkingSpotRepository } from "../repositories/parkingSpotRepository.js";
import { ParkingZoneRepository } from "../repositories/parkingZoneRepository.js";

const parkingZoneSchema = z.object({
  zoneCode: z
    .string()
    .trim()
    .min(1, "Zone ID is required.")
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z]{1,4}$/.test(value), {
      message: "Zone ID must use 1 to 4 uppercase letters.",
    }),
  name: z.string().trim().min(1, "Parking zone name is required."),
  description: z.string().trim().optional(),
  capacity: z.number().int("Capacity must be a whole number.").min(1, "Capacity must be at least 1."),
  distanceFromEntryMeters: z
    .number()
    .int("Distance from entry must be a whole number.")
    .min(0, "Distance from entry cannot be negative.")
    .optional(),
  displayOrder: z
    .number()
    .int("Display order must be a whole number.")
    .min(0, "Display order cannot be negative.")
    .optional(),
  defaultSpotLevel: z
    .string()
    .trim()
    .max(50, "Default spot level cannot exceed 50 characters.")
    .optional(),
});

const updateParkingZoneSchema = z
  .object({
    zoneCode: z
      .string()
      .trim()
      .min(1, "Zone ID is required.")
      .transform((value) => value.toUpperCase())
      .refine((value) => /^[A-Z]{1,4}$/.test(value), {
        message: "Zone ID must use 1 to 4 uppercase letters.",
      })
      .optional(),
    name: z.string().trim().min(1, "Parking zone name is required.").optional(),
    description: z.string().trim().optional(),
    capacity: z
      .number()
      .int("Capacity must be a whole number.")
      .min(1, "Capacity must be at least 1.")
      .optional(),
    distanceFromEntryMeters: z
      .number()
      .int("Distance from entry must be a whole number.")
      .min(0, "Distance from entry cannot be negative.")
      .optional(),
    displayOrder: z
      .number()
      .int("Display order must be a whole number.")
      .min(0, "Display order cannot be negative.")
      .optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one parking zone field is required.",
  });

export type CreateParkingZoneInput = z.input<typeof parkingZoneSchema>;
export type UpdateParkingZoneInput = z.input<typeof updateParkingZoneSchema>;

export class ParkingZoneValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Parking zone input is invalid.");
    this.name = "ParkingZoneValidationError";
  }
}

export class DuplicateParkingZoneNameError extends Error {
  constructor() {
    super("A parking zone with this name already exists.");
    this.name = "DuplicateParkingZoneNameError";
  }
}

export class DuplicateParkingZoneCodeError extends Error {
  constructor() {
    super("A parking zone with this Zone ID already exists.");
    this.name = "DuplicateParkingZoneCodeError";
  }
}

export class ParkingZoneNotFoundError extends Error {
  constructor() {
    super("Parking zone not found.");
    this.name = "ParkingZoneNotFoundError";
  }
}

export class ParkingZoneCapacityConflictError extends Error {
  constructor(existingSpotCount: number, requestedCapacity: number) {
    super(
      `Parking zone capacity cannot be reduced to ${requestedCapacity} because ${existingSpotCount} spots already exist.`,
    );
    this.name = "ParkingZoneCapacityConflictError";
  }
}

export class ParkingZoneService {
  constructor(
    private readonly parkingZoneRepository = new ParkingZoneRepository(),
    private readonly parkingSpotRepository = new ParkingSpotRepository(),
  ) {}

  async listZones() {
    return this.parkingZoneRepository.list();
  }

  async findZoneById(id: string) {
    const zone = await this.parkingZoneRepository.findById(id);

    if (!zone) {
      throw new ParkingZoneNotFoundError();
    }

    return zone;
  }

  async createZone(input: CreateParkingZoneInput) {
    const parsed = parkingZoneSchema.safeParse(input);

    if (!parsed.success) {
      throw new ParkingZoneValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    await this.assertZoneNameAvailable(parsed.data.name);
    await this.assertZoneCodeAvailable(parsed.data.zoneCode);
    const { defaultSpotLevel: defaultSpotLevelInput, ...parkingZoneInput } = parsed.data;
    const defaultSpotLevel = defaultSpotLevelInput?.trim();

    return this.parkingZoneRepository.createWithSpots(
      parkingZoneInput,
      generateSpotCodes(parsed.data.zoneCode, parsed.data.capacity),
      defaultSpotLevel && defaultSpotLevel.length > 0 ? defaultSpotLevel : undefined,
    );
  }

  async updateZone(id: string, input: UpdateParkingZoneInput) {
    const parsed = updateParkingZoneSchema.safeParse(input);

    if (!parsed.success) {
      throw new ParkingZoneValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    const existing = await this.parkingZoneRepository.findById(id);

    if (!existing) {
      throw new ParkingZoneNotFoundError();
    }

    if (parsed.data.name && parsed.data.name !== existing.name) {
      await this.assertZoneNameAvailable(parsed.data.name);
    }

    if (parsed.data.zoneCode && parsed.data.zoneCode !== existing.zoneCode) {
      await this.assertZoneCodeAvailable(parsed.data.zoneCode);
    }

    if (parsed.data.capacity !== undefined) {
      await this.assertCapacityCanHoldExistingSpots(id, parsed.data.capacity);
    }

    return this.parkingZoneRepository.update(id, parsed.data);
  }

  async deleteZone(id: string) {
    const existing = await this.parkingZoneRepository.findById(id);

    if (!existing) {
      throw new ParkingZoneNotFoundError();
    }

    return this.parkingZoneRepository.delete(id);
  }

  private async assertZoneNameAvailable(name: string): Promise<void> {
    const existing = await this.parkingZoneRepository.findByName(name);

    if (existing) {
      throw new DuplicateParkingZoneNameError();
    }
  }

  private async assertZoneCodeAvailable(zoneCode: string): Promise<void> {
    const existing = await this.parkingZoneRepository.findByZoneCode(zoneCode);

    if (existing) {
      throw new DuplicateParkingZoneCodeError();
    }
  }

  private async assertCapacityCanHoldExistingSpots(
    zoneId: string,
    requestedCapacity: number,
  ): Promise<void> {
    const existingSpotCount = await this.parkingSpotRepository.countByZoneId(zoneId);

    if (requestedCapacity < existingSpotCount) {
      throw new ParkingZoneCapacityConflictError(existingSpotCount, requestedCapacity);
    }
  }
}

function generateSpotCodes(zoneCode: string, capacity: number): string[] {
  return Array.from({ length: capacity }, (_, index) => (
    `${zoneCode}-${String(index + 1).padStart(3, "0")}`
  ));
}
