import type { AccountStatus, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";
import { adminUserSummarySelect } from "../utils/safeUser.js";
import { z } from "zod";

const activeSubscriptionSelect = {
  id: true,
  endTime: true,
} as const;

export interface AdminUserSubscriptionSummary {
  status: "subscribed" | "notSubscribed";
  endTime: Date | null;
}

export interface ListAdminUsersInput {
  page?: unknown;
  pageSize?: unknown;
  search?: unknown;
  role?: unknown;
  accountStatus?: unknown;
  subscriptionStatus?: unknown;
}

const listAdminUsersSchema = z.object({
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
  search: z.string().trim().min(1, "Search cannot be blank.").optional(),
  role: z.enum(["driver", "admin"]).optional(),
  accountStatus: z.enum(["active", "disabled", "pending"]).optional(),
  subscriptionStatus: z.enum(["subscribed", "notSubscribed"]).optional(),
});

export class AdminUserNotFoundError extends Error {
  constructor() {
    super("User not found.");
    this.name = "AdminUserNotFoundError";
  }
}

export class AdminUserValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Admin user query is invalid.");
    this.name = "AdminUserValidationError";
  }
}

export class AdminUserService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async listUsers(input: ListAdminUsersInput = {}) {
    const parsed = listAdminUsersSchema.safeParse(input);

    if (!parsed.success) {
      throw new AdminUserValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    const now = new Date();
    const search = parsed.data.search?.toLowerCase();
    const activeSubscriptionWhere = {
      status: "active" as const,
      startTime: { lte: now },
      endTime: { gte: now },
    };
    const where = {
      role: parsed.data.role,
      accountStatus: parsed.data.accountStatus,
      subscriptions:
        parsed.data.subscriptionStatus === "subscribed"
          ? { some: activeSubscriptionWhere }
          : parsed.data.subscriptionStatus === "notSubscribed"
            ? { none: activeSubscriptionWhere }
            : undefined,
      OR: search
        ? [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { universityId: { contains: search, mode: "insensitive" as const } },
          ]
        : undefined,
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ role: "asc" }, { email: "asc" }],
        skip: (parsed.data.page - 1) * parsed.data.pageSize,
        take: parsed.data.pageSize,
        select: {
          ...adminUserSummarySelect,
          subscriptions: {
            where: {
              ...activeSubscriptionWhere,
            },
            orderBy: { endTime: "desc" },
            take: 1,
            select: activeSubscriptionSelect,
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    const usersWithSubscription = users.map(toAdminUserSummaryWithSubscription);

    return {
      users: usersWithSubscription,
      pagination: {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / parsed.data.pageSize)),
      },
    };
  }

  async disableUser(userId: string) {
    return this.updateAccountStatus(
      userId,
      "disabled",
      "Account disabled",
      "Your parking account has been disabled by an administrator.",
    );
  }

  async reactivateUser(userId: string) {
    return this.updateAccountStatus(
      userId,
      "active",
      "Account reactivated",
      "Your parking account has been reactivated by an administrator.",
    );
  }

  private async updateAccountStatus(
    userId: string,
    accountStatus: AccountStatus,
    notificationTitle: string,
    notificationMessage: string,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) {
      throw new AdminUserNotFoundError();
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { accountStatus },
        select: adminUserSummarySelect,
      }),
      this.prisma.notification.create({
        data: {
          userId,
          type: "accountStatus",
          status: "sent",
          title: notificationTitle,
          message: notificationMessage,
          sentAt: new Date(),
        },
      }),
    ]);

    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...adminUserSummarySelect,
        subscriptions: {
          where: {
            status: "active",
            startTime: { lte: now },
            endTime: { gte: now },
          },
          orderBy: { endTime: "desc" },
          take: 1,
          select: activeSubscriptionSelect,
        },
      },
    });

    if (!user) {
      throw new AdminUserNotFoundError();
    }

    return toAdminUserSummaryWithSubscription(user);
  }
}

function toAdminUserSummaryWithSubscription<
  T extends { subscriptions: Array<{ endTime: Date }> },
>(user: T) {
  const { subscriptions, ...summary } = user;
  const activeSubscription = subscriptions[0] ?? null;

  return {
    ...summary,
    subscription: {
      status: activeSubscription ? "subscribed" : "notSubscribed",
      endTime: activeSubscription?.endTime ?? null,
    } satisfies AdminUserSubscriptionSummary,
  };
}
