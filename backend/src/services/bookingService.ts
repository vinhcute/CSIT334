import { SpotStatus } from "@prisma/client";
import { z } from "zod";
import { parkingEvents } from "../realtime/parkingEvents.js";
import { BookingRepository } from "../repositories/bookingRepository.js";
import { ParkingSpotRepository } from "../repositories/parkingSpotRepository.js";
import { SubscriptionRepository } from "../repositories/subscriptionRepository.js";
import { UserRepository } from "../repositories/userRepository.js";
import { BookingNotificationService } from "./bookingNotificationService.js";
import { OccupancyService } from "./occupancyService.js";

const createBookingSchema = z.object({
  spotId: z.string().trim().min(1, "Parking spot ID is required."),
  startTime: z.coerce.date({ error: "Start time is required." }),
  endTime: z.coerce.date({ error: "End time is required." }),
});
const adminBookingFiltersSchema = z
  .object({
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
    status: z.enum(["pending", "confirmed", "cancelled", "expired", "completed"]).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    userId: z.string().trim().min(1, "User ID cannot be blank.").optional(),
    zoneId: z.string().trim().min(1, "Zone ID cannot be blank.").optional(),
    userSearch: z.string().trim().min(1, "User search cannot be blank.").optional(),
    zoneName: z.string().trim().min(1, "Zone name cannot be blank.").optional(),
  })
  .superRefine((value, context) => {
    if (value.from && Number.isNaN(value.from.getTime())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "From date is invalid.",
      });
    }

    if (value.to && Number.isNaN(value.to.getTime())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "To date is invalid.",
      });
    }

    if (value.from && value.to && value.from.getTime() > value.to.getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "From date must be before or equal to to date.",
      });
    }
  });

const bookingGracePeriodMilliseconds = 15 * 60 * 1000;
const occupiedImmediateWindowMilliseconds = 5 * 60 * 1000;
const cancellableBookingStatuses = new Set(["pending", "confirmed"]);

export type CreateBookingInput = z.input<typeof createBookingSchema>;

export class BookingValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Booking input is invalid.");
    this.name = "BookingValidationError";
  }
}

export class BookingUserNotFoundError extends Error {
  constructor() {
    super("User account not found.");
    this.name = "BookingUserNotFoundError";
  }
}

export class BookingAccountDisabledError extends Error {
  constructor() {
    super("Disabled accounts cannot create bookings.");
    this.name = "BookingAccountDisabledError";
  }
}

export class BookingSubscriptionEligibilityError extends Error {
  constructor() {
    super("An active parking permit is required for this booking window.");
    this.name = "BookingSubscriptionEligibilityError";
  }
}

export class BookingSpotNotFoundError extends Error {
  constructor() {
    super("Parking spot not found.");
    this.name = "BookingSpotNotFoundError";
  }
}

export class BookingSpotMaintenanceConflictError extends Error {
  constructor() {
    super("This parking spot is under maintenance and cannot be booked.");
    this.name = "BookingSpotMaintenanceConflictError";
  }
}

export class BookingSpotOccupiedConflictError extends Error {
  constructor() {
    super("This parking spot is currently occupied for immediate booking.");
    this.name = "BookingSpotOccupiedConflictError";
  }
}

export class BookingConflictError extends Error {
  constructor() {
    super("This parking spot already has an overlapping booking.");
    this.name = "BookingConflictError";
  }
}

export class BookingNotFoundError extends Error {
  constructor() {
    super("Booking not found.");
    this.name = "BookingNotFoundError";
  }
}

export class BookingCancellationConflictError extends Error {
  constructor(message = "This booking cannot be cancelled.") {
    super(message);
    this.name = "BookingCancellationConflictError";
  }
}

export class BookingService {
  constructor(
    private readonly bookingRepository = new BookingRepository(),
    private readonly userRepository = new UserRepository(),
    private readonly subscriptionRepository = new SubscriptionRepository(),
    private readonly parkingSpotRepository = new ParkingSpotRepository(),
    private readonly bookingNotificationService = new BookingNotificationService(
      bookingRepository,
    ),
    private readonly occupancyService = new OccupancyService(),
    private readonly parkingEventStream: Pick<
      typeof parkingEvents,
      "broadcastParkingUpdate"
    > = parkingEvents,
  ) {}

  async createBooking(userId: string, input: CreateBookingInput, now = new Date()) {
    const parsed = createBookingSchema.safeParse(input);

    if (!parsed.success) {
      throw new BookingValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    this.assertValidWindow(parsed.data.startTime, parsed.data.endTime, now);

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new BookingUserNotFoundError();
    }

    if (user.accountStatus === "disabled") {
      throw new BookingAccountDisabledError();
    }

    const activeSubscription = await this.subscriptionRepository.findActiveCoveringWindow(
      userId,
      parsed.data.startTime,
      parsed.data.endTime,
    );

    if (!activeSubscription) {
      throw new BookingSubscriptionEligibilityError();
    }

    const parkingSpot = await this.parkingSpotRepository.findById(parsed.data.spotId);

    if (!parkingSpot) {
      throw new BookingSpotNotFoundError();
    }

    if (parkingSpot.status === SpotStatus.maintenanceRequired) {
      throw new BookingSpotMaintenanceConflictError();
    }

    if (
      parkingSpot.status === SpotStatus.occupied &&
      parsed.data.startTime.getTime() <= now.getTime() + occupiedImmediateWindowMilliseconds
    ) {
      throw new BookingSpotOccupiedConflictError();
    }

    const overlappingBooking = await this.bookingRepository.findOverlappingActiveBooking(
      parsed.data.spotId,
      parsed.data.startTime,
      parsed.data.endTime,
    );

    if (overlappingBooking) {
      throw new BookingConflictError();
    }

    const expiresAt = new Date(parsed.data.startTime.getTime() + bookingGracePeriodMilliseconds);

    const result = await this.bookingRepository.createConfirmedBookingWithSpotReservation({
      userId,
      spotId: parsed.data.spotId,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      expiresAt,
    });

    await this.bookingNotificationService.createConfirmationNotification(result.booking);
    const zoneSummary = await this.occupancyService.getZoneDetail(result.parkingSpot.zoneId);
    this.parkingEventStream.broadcastParkingUpdate({
      spotId: result.parkingSpot.id,
      zoneId: result.parkingSpot.zoneId,
      status: result.parkingSpot.status,
      zoneSummary,
    });

    return result;
  }

  async cancelBooking(userId: string, bookingId: string, now = new Date()) {
    const normalizedBookingId = bookingId.trim();

    if (!normalizedBookingId) {
      throw new BookingValidationError(["Booking ID is required."]);
    }

    const booking = await this.bookingRepository.findByIdForUser(normalizedBookingId, userId);

    if (!booking) {
      throw new BookingNotFoundError();
    }

    if (!cancellableBookingStatuses.has(booking.status)) {
      throw new BookingCancellationConflictError(
        "Only pending or confirmed bookings can be cancelled.",
      );
    }

    if (booking.startTime.getTime() <= now.getTime()) {
      throw new BookingCancellationConflictError(
        "Only upcoming bookings can be cancelled.",
      );
    }

    const cancelledBooking = await this.bookingRepository.cancelBooking(booking.id);
    const otherActiveCount = await this.bookingRepository.countActiveBlockingBookingsForSpot(
      cancelledBooking.spotId,
      cancelledBooking.id,
    );

    const shouldReleaseSpot =
      cancelledBooking.spot.status === SpotStatus.reserved && otherActiveCount === 0;

    if (!shouldReleaseSpot) {
      return { booking: cancelledBooking, parkingSpot: null };
    }

    const releasedSpot = await this.bookingRepository.updateSpotStatus(
      cancelledBooking.spotId,
      SpotStatus.available,
    );
    const zoneSummary = await this.occupancyService.getZoneDetail(releasedSpot.zoneId);
    this.parkingEventStream.broadcastParkingUpdate({
      spotId: releasedSpot.id,
      zoneId: releasedSpot.zoneId,
      status: releasedSpot.status,
      zoneSummary,
    });

    return { booking: cancelledBooking, parkingSpot: releasedSpot };
  }

  async listAdminBookings(filters: unknown) {
    const parsed = adminBookingFiltersSchema.safeParse(filters ?? {});

    if (!parsed.success) {
      throw new BookingValidationError(parsed.error.issues.map((issue) => issue.message));
    }

    return this.bookingRepository.listForAdmin(parsed.data);
  }

  async listMyBookings(userId: string) {
    return this.bookingRepository.listForUser(userId);
  }

  async getMyBooking(userId: string, bookingId: string) {
    const normalizedBookingId = bookingId.trim();

    if (!normalizedBookingId) {
      throw new BookingValidationError(["Booking ID is required."]);
    }

    const booking = await this.bookingRepository.findByIdForUser(normalizedBookingId, userId);

    if (!booking) {
      throw new BookingNotFoundError();
    }

    return booking;
  }

  async getAdminBooking(bookingId: string) {
    const normalizedBookingId = bookingId.trim();

    if (!normalizedBookingId) {
      throw new BookingValidationError(["Booking ID is required."]);
    }

    const booking = await this.bookingRepository.findById(normalizedBookingId);

    if (!booking) {
      throw new BookingNotFoundError();
    }

    return booking;
  }

  private assertValidWindow(startTime: Date, endTime: Date, now: Date): void {
    if (Number.isNaN(startTime.getTime())) {
      throw new BookingValidationError(["Start time is required."]);
    }

    if (Number.isNaN(endTime.getTime())) {
      throw new BookingValidationError(["End time is required."]);
    }

    if (startTime.getTime() <= now.getTime()) {
      throw new BookingValidationError(["Start time must be in the future."]);
    }

    if (endTime.getTime() <= startTime.getTime()) {
      throw new BookingValidationError(["End time must be after start time."]);
    }
  }
}
