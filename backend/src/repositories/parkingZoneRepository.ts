import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

const parkingZoneSelect = {
  id: true,
  name: true,
  description: true,
  capacity: true,
  distanceFromEntryMeters: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface CreateParkingZoneRecordInput {
  name: string;
  description?: string;
  capacity: number;
  distanceFromEntryMeters?: number;
  displayOrder?: number;
}

export interface UpdateParkingZoneRecordInput {
  name?: string;
  description?: string | null;
  capacity?: number;
  distanceFromEntryMeters?: number | null;
  displayOrder?: number;
}

export class ParkingZoneRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async list() {
    return this.prisma.parkingZone.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: parkingZoneSelect,
    });
  }

  async findById(id: string) {
    return this.prisma.parkingZone.findUnique({
      where: { id },
      select: parkingZoneSelect,
    });
  }

  async findByName(name: string) {
    return this.prisma.parkingZone.findUnique({
      where: { name },
      select: parkingZoneSelect,
    });
  }

  async create(input: CreateParkingZoneRecordInput) {
    return this.prisma.parkingZone.create({
      data: input,
      select: parkingZoneSelect,
    });
  }

  async update(id: string, input: UpdateParkingZoneRecordInput) {
    return this.prisma.parkingZone.update({
      where: { id },
      data: input,
      select: parkingZoneSelect,
    });
  }

  async delete(id: string) {
    return this.prisma.parkingZone.delete({
      where: { id },
      select: parkingZoneSelect,
    });
  }
}
