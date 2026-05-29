import type { AccountStatus, PrismaClient, UserRole } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";
import { safeUserSelect } from "../utils/safeUser.js";

export interface CreateDriverWithVehicleInput {
  name: string;
  email: string;
  universityId: string;
  passwordHash: string;
  licensePlate: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
}

export interface UpdateUserProfileInput {
  name: string;
  email: string;
  universityId: string;
}

export class UserRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async createDriverWithVehicle(input: CreateDriverWithVehicleInput) {
    return this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        universityId: input.universityId,
        passwordHash: input.passwordHash,
        role: "driver",
        accountStatus: "active",
        vehicleProfiles: {
          create: {
            licensePlate: input.licensePlate,
            vehicleMake: input.vehicleMake,
            vehicleModel: input.vehicleModel,
            vehicleColor: input.vehicleColor,
            isPrimary: true,
          },
        },
      },
      select: safeUserSelect,
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: safeUserSelect,
    });
  }

  async findByUniversityId(universityId: string) {
    return this.prisma.user.findUnique({
      where: { universityId },
      select: safeUserSelect,
    });
  }

  async findAuthRecordByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        accountStatus: true,
      },
    });
  }

  async findAuthRecordById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        accountStatus: true,
      },
    });
  }

  async updatePasswordHash(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: safeUserSelect,
    });
  }

  async updateProfile(userId: string, input: UpdateUserProfileInput) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        email: input.email,
        universityId: input.universityId,
      },
      select: safeUserSelect,
    });
  }

  async updateAccountStatus(userId: string, accountStatus: AccountStatus) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus },
      select: safeUserSelect,
    });
  }

  async listByRole(role: UserRole) {
    return this.prisma.user.findMany({
      where: { role },
      orderBy: { email: "asc" },
      select: safeUserSelect,
    });
  }
}
