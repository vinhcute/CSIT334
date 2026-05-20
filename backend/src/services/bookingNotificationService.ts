import type { NotificationType } from "@prisma/client";
import { BookingRepository } from "../repositories/bookingRepository.js";

const reminderWindowMilliseconds = 30 * 60 * 1000;

interface BookingNotificationBooking {
  id: string;
  userId: string;
  spot: {
    spotCode: string;
    zone: {
      name: string;
    };
  };
  startTime: Date;
}

export class BookingNotificationService {
  constructor(private readonly bookingRepository = new BookingRepository()) {}

  async createConfirmationNotification(booking: BookingNotificationBooking) {
    return this.bookingRepository.createBookingNotification({
      userId: booking.userId,
      bookingId: booking.id,
      type: "bookingConfirmation",
      title: "Booking confirmed",
      message: `Your booking for ${booking.spot.zone.name} ${booking.spot.spotCode} has been confirmed.`,
      status: "sent",
      sentAt: new Date(),
    });
  }

  async createDueBookingReminders(now = new Date()) {
    const windowEnd = new Date(now.getTime() + reminderWindowMilliseconds);
    const dueBookings = await this.bookingRepository.findDueReminderBookings(now, windowEnd);
    let createdCount = 0;

    for (const booking of dueBookings) {
      const existing = await this.bookingRepository.findBookingNotificationByType(
        booking.id,
        "bookingReminder",
      );

      if (existing) {
        continue;
      }

      await this.bookingRepository.createBookingNotification({
        userId: booking.userId,
        bookingId: booking.id,
        type: "bookingReminder",
        title: "Booking reminder",
        message: `Reminder: your booking for ${booking.spot.zone.name} ${booking.spot.spotCode} starts soon.`,
        status: "sent",
        sentAt: new Date(),
      });
      createdCount += 1;
    }

    return {
      scanned: dueBookings.length,
      created: createdCount,
      reminderType: "bookingReminder" satisfies NotificationType,
    };
  }
}
