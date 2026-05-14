import { z } from "zod";
import { SubscriptionRepository } from "../repositories/subscriptionRepository.js";

const subscriptionRequestSchema = z.object({
  type: z.enum(["daily", "weekly", "monthly"], {
    message: "Subscription type must be daily, weekly, or monthly.",
  }),
});

const durationDaysByType = {
  daily: 1,
  weekly: 7,
  monthly: 30,
} as const;

export type CreateSubscriptionRequest = z.input<typeof subscriptionRequestSchema>;

export class SubscriptionValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Subscription input is invalid.");
    this.name = "SubscriptionValidationError";
  }
}

export class SubscriptionService {
  constructor(private readonly subscriptionRepository = new SubscriptionRepository()) {}

  async createOrRenew(userId: string, input: CreateSubscriptionRequest) {
    const parsed = subscriptionRequestSchema.safeParse(input);

    if (!parsed.success) {
      throw new SubscriptionValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    const now = new Date();
    const latestActive = await this.subscriptionRepository.findLatestActiveByUserId(userId);
    const startTime =
      latestActive && latestActive.endTime > now ? latestActive.endTime : now;
    const endTime = new Date(
      startTime.getTime() + durationDaysByType[parsed.data.type] * 24 * 60 * 60 * 1000,
    );
    const subscription = await this.subscriptionRepository.createActive({
      userId,
      type: parsed.data.type,
      startTime,
      endTime,
    });

    return {
      subscription,
      message: "Simulated subscription activated; no payment was processed.",
    };
  }
}
