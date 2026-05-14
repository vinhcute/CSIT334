import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

const safeVehicleProfileSelect = {
  id: true,
  userId: true,
  licensePlate: true,
  vehicleMake: true,
  vehicleModel: true,
  vehicleColor: true,
  isPrimary: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface CreateVehicleProfileInput {
  userId: string;
  licensePlate: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  isPrimary?: boolean;
}

export interface UpdateVehicleProfileInput {
  licensePlate?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  isPrimary?: boolean;
}

export class VehicleProfileRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async listByUserId(userId: string) {
    return this.prisma.vehicleProfile.findMany({
      where: { userId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: safeVehicleProfileSelect,
    });
  }

  async findById(id: string) {
    return this.prisma.vehicleProfile.findUnique({
      where: { id },
      select: safeVehicleProfileSelect,
    });
  }

  async findByLicensePlate(licensePlate: string) {
    return this.prisma.vehicleProfile.findUnique({
      where: { licensePlate },
      select: safeVehicleProfileSelect,
    });
  }

  async create(input: CreateVehicleProfileInput) {
    return this.prisma.vehicleProfile.create({
      data: {
        userId: input.userId,
        licensePlate: input.licensePlate,
        vehicleMake: input.vehicleMake,
        vehicleModel: input.vehicleModel,
        vehicleColor: input.vehicleColor,
        isPrimary: input.isPrimary ?? false,
      },
      select: safeVehicleProfileSelect,
    });
  }

  async update(id: string, input: UpdateVehicleProfileInput) {
    return this.prisma.vehicleProfile.update({
      where: { id },
      data: input,
      select: safeVehicleProfileSelect,
    });
  }
}
