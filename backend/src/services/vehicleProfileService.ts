import { z } from "zod";
import { VehicleProfileRepository } from "../repositories/vehicleProfileRepository.js";

const createVehicleProfileSchema = z.object({
  licensePlate: z.string().trim().min(1, "Licence plate is required."),
  vehicleMake: z.string().trim().optional(),
  vehicleModel: z.string().trim().optional(),
  vehicleColor: z.string().trim().optional(),
  isPrimary: z.boolean().optional(),
});

const updateVehicleProfileSchema = createVehicleProfileSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one vehicle profile field is required.",
  });

export type CreateVehicleProfileInput = z.input<typeof createVehicleProfileSchema>;
export type UpdateVehicleProfileInput = z.input<typeof updateVehicleProfileSchema>;

export class VehicleProfileValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Vehicle profile input is invalid.");
    this.name = "VehicleProfileValidationError";
  }
}

export class DuplicateLicensePlateError extends Error {
  constructor() {
    super("A vehicle with this licence plate already exists.");
    this.name = "DuplicateLicensePlateError";
  }
}

export class VehicleProfileNotFoundError extends Error {
  constructor() {
    super("Vehicle profile not found.");
    this.name = "VehicleProfileNotFoundError";
  }
}

export class VehicleProfileService {
  constructor(private readonly vehicleProfileRepository = new VehicleProfileRepository()) {}

  async listMine(userId: string) {
    return this.vehicleProfileRepository.listByUserId(userId);
  }

  async createMine(userId: string, input: CreateVehicleProfileInput) {
    const parsed = createVehicleProfileSchema.safeParse(input);

    if (!parsed.success) {
      throw new VehicleProfileValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    await this.assertLicensePlateAvailable(parsed.data.licensePlate);

    return this.vehicleProfileRepository.create({
      userId,
      ...parsed.data,
    });
  }

  async updateMine(userId: string, vehicleProfileId: string, input: UpdateVehicleProfileInput) {
    const parsed = updateVehicleProfileSchema.safeParse(input);

    if (!parsed.success) {
      throw new VehicleProfileValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    const existing = await this.vehicleProfileRepository.findById(vehicleProfileId);

    if (!existing || existing.userId !== userId) {
      throw new VehicleProfileNotFoundError();
    }

    if (parsed.data.licensePlate && parsed.data.licensePlate !== existing.licensePlate) {
      await this.assertLicensePlateAvailable(parsed.data.licensePlate);
    }

    return this.vehicleProfileRepository.update(vehicleProfileId, parsed.data);
  }

  private async assertLicensePlateAvailable(licensePlate: string): Promise<void> {
    const existing = await this.vehicleProfileRepository.findByLicensePlate(licensePlate);

    if (existing) {
      throw new DuplicateLicensePlateError();
    }
  }
}
