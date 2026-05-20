import type { BookingStatus, NotificationType, PrismaClient, SpotStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";

const bookingSelect = {
  id: true,
  userId: true,
  spotId: true,
  status: true,
  startTime: true,
  endTime: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  spot: {
    select: {
      id: true,
      zoneId: true,
      spotCode: true,
      status: true,
      level: true,
      rowLabel: true,
      zone: {
        select: {
          id: true,
          name: true,
          distanceFromEntryMeters: true,
          displayOrder: true,
        },
      },
    },
  },
} as const;

const adminBookingSelect = {
  ...bookingSelect,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accountStatus: true,
    },
  },
} as const;

const spotStatusSelect = {
  id: true,
  zoneId: true,
  spotCode: true,
  status: true,
  level: true,
  rowLabel: true,
  createdAt: true,
  updatedAt: true,
} as const;

const bookingNotificationSelect = {
  id: true,
  userId: true,
  bookingId: true,
  type: true,
  status: true,
  title: true,
  message: true,
  sentAt: true,
  readAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface CreateConfirmedBookingInput {
  userId: string;
  spotId: string;
  startTime: Date;
  endTime: Date;
  expiresAt: Date | null;
}

export interface ListAdminBookingFilters {
  page: number;
  pageSize: number;
  status?: BookingStatus;
  from?: Date;
  to?: Date;
  userId?: string;
  zoneId?: string;
  userSearch?: string;
  zoneName?: string;
}

export interface CreateBookingNotificationInput {
  userId: string;
  bookingId: string;
  type: NotificationType;
  title: string;
  message: string;
  status?: "pending" | "sent" | "read";
  sentAt?: Date | null;
}

export class BookingRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async createConfirmedBookingWithSpotReservation(input: CreateConfirmedBookingInput) {
    return this.prisma.$transaction(async (transaction) => {
      const booking = await transaction.booking.create({
        data: {
          userId: input.userId,
          spotId: input.spotId,
          status: "confirmed",
          startTime: input.startTime,
          endTime: input.endTime,
          expiresAt: input.expiresAt,
        },
        select: bookingSelect,
      });

      const parkingSpot = await transaction.parkingSpot.update({
        where: { id: input.spotId },
        data: { status: "reserved" },
        select: spotStatusSelect,
      });

      return { booking, parkingSpot };
    });
  }

  async findOverlappingActiveBooking(spotId: string, startTime: Date, endTime: Date) {
    return this.prisma.booking.findFirst({
      where: {
        spotId,
        status: { in: ["pending", "confirmed"] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      orderBy: { startTime: "asc" },
      select: bookingSelect,
    });
  }

  async findById(id: string) {
    return this.prisma.booking.findUnique({
      where: { id },
      select: bookingSelect,
    });
  }

  async findByIdForUser(id: string, userId: string) {
    return this.prisma.booking.findFirst({
      where: { id, userId },
      select: bookingSelect,
    });
  }

  async listForUser(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      orderBy: [{ startTime: "desc" }, { createdAt: "desc" }],
      select: bookingSelect,
    });
  }

  async listForAdmin(filters: ListAdminBookingFilters) {
    const where = {
      where: {
        status: filters.status,
        userId: filters.userId,
        user: filters.userSearch
          ? {
              OR: [
                { name: { contains: filters.userSearch, mode: "insensitive" as const } },
                { email: { contains: filters.userSearch, mode: "insensitive" as const } },
              ],
            }
          : undefined,
        spot:
          filters.zoneId || filters.zoneName
            ? {
                zoneId: filters.zoneId,
                zone: filters.zoneName
                  ? {
                      name: { contains: filters.zoneName, mode: "insensitive" as const },
                    }
                  : undefined,
              }
            : undefined,
        startTime: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
      },
    };
    const [bookings, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        ...where,
        orderBy: [{ startTime: "desc" }, { createdAt: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        select: adminBookingSelect,
      }),
      this.prisma.booking.count(where),
    ]);

    return {
      bookings,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      },
    };
  }

  async cancelBooking(id: string) {
    return this.prisma.booking.update({
      where: { id },
      data: { status: "cancelled" },
      select: bookingSelect,
    });
  }

  async expireBooking(id: string) {
    return this.prisma.booking.update({
      where: { id },
      data: { status: "expired" },
      select: bookingSelect,
    });
  }

  async findExpirableBookings(now: Date) {
    return this.prisma.booking.findMany({
      where: {
        status: { in: ["pending", "confirmed"] },
        expiresAt: { not: null, lte: now },
      },
      orderBy: { expiresAt: "asc" },
      select: bookingSelect,
    });
  }

  async countActiveBlockingBookingsForSpot(spotId: string, excludeBookingId?: string) {
    return this.prisma.booking.count({
      where: {
        spotId,
        status: { in: ["pending", "confirmed"] },
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
      },
    });
  }

  async updateSpotStatus(spotId: string, status: SpotStatus) {
    return this.prisma.parkingSpot.update({
      where: { id: spotId },
      data: { status },
      select: spotStatusSelect,
    });
  }

  async createBookingNotification(input: CreateBookingNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        bookingId: input.bookingId,
        type: input.type,
        status: input.status ?? "pending",
        title: input.title,
        message: input.message,
        sentAt: input.sentAt ?? null,
      },
      select: bookingNotificationSelect,
    });
  }

  async findBookingNotificationByType(bookingId: string, type: NotificationType) {
    return this.prisma.notification.findFirst({
      where: { bookingId, type },
      select: bookingNotificationSelect,
    });
  }

  async findDueReminderBookings(windowStart: Date, windowEnd: Date) {
    return this.prisma.booking.findMany({
      where: {
        status: { in: ["pending", "confirmed"] },
        startTime: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      orderBy: { startTime: "asc" },
      select: bookingSelect,
    });
  }
}
