import type { AccountStatus, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/database.js";
import { adminUserSummarySelect } from "../utils/safeUser.js";

export class AdminUserNotFoundError extends Error {
  constructor() {
    super("User not found.");
    this.name = "AdminUserNotFoundError";
  }
}

export class AdminUserService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: [{ role: "asc" }, { email: "asc" }],
      select: adminUserSummarySelect,
    });
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

    const [user] = await this.prisma.$transaction([
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

    return user;
  }
}
