import { BookingStatus, SpotStatus } from "./enums.js";
import type { BookingId, ParkingSpotId, UserId } from "./types.js";

export interface CreateBookingInput {
  spotId: ParkingSpotId;
  startTime: Date;
  endTime: Date;
}

export interface BookingSummary {
  id: BookingId;
  userId: UserId;
  spotId: ParkingSpotId;
  status: BookingStatus;
  startTime: Date;
  endTime: Date;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingDetail extends BookingSummary {
  spotCode: string;
  zoneId: string;
  zoneName: string;
  spotStatus: SpotStatus;
}

export interface BookingListFilters {
  status?: BookingStatus;
  from?: Date;
  to?: Date;
  userId?: UserId;
  zoneId?: string;
}

export type BookingStatusLabel =
  | "Pending"
  | "Confirmed"
  | "Cancelled"
  | "Expired"
  | "Completed";

export type BookingNotificationKind = "bookingConfirmation" | "bookingReminder";

const activeBlockingStatuses = new Set<BookingStatus>([
  BookingStatus.Pending,
  BookingStatus.Confirmed,
]);
const terminalStatuses = new Set<BookingStatus>([
  BookingStatus.Cancelled,
  BookingStatus.Expired,
  BookingStatus.Completed,
]);
const cancellableStatuses = new Set<BookingStatus>([
  BookingStatus.Pending,
  BookingStatus.Confirmed,
]);

export function isActiveBlockingBookingStatus(status: BookingStatus): boolean {
  return activeBlockingStatuses.has(status);
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return terminalStatuses.has(status);
}

export function isDriverCancellableBookingStatus(status: BookingStatus): boolean {
  return cancellableStatuses.has(status);
}

export function isEligibleUpcomingCancellation(startTime: Date, now: Date): boolean {
  return startTime.getTime() > now.getTime();
}

export function shouldReleaseReservedSpotAfterBookingStatusChange(input: {
  spotStatus: SpotStatus;
  hasOtherActiveBlockingBookings: boolean;
}): boolean {
  if (input.spotStatus !== SpotStatus.Reserved) {
    return false;
  }

  if (input.hasOtherActiveBlockingBookings) {
    return false;
  }

  return true;
}
