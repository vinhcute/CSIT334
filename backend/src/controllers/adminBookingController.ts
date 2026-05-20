import type { Request, Response } from "express";
import {
  BookingNotFoundError,
  BookingService,
  BookingValidationError,
} from "../services/bookingService.js";

export class AdminBookingController {
  constructor(private readonly bookingService = new BookingService()) {}

  index = async (request: Request, response: Response): Promise<void> => {
    try {
      const result = await this.bookingService.listAdminBookings(request.query);
      response.json(result);
    } catch (error) {
      this.handleError(error, response);
    }
  };

  show = async (request: Request, response: Response): Promise<void> => {
    try {
      const bookingId = typeof request.params.id === "string" ? request.params.id : "";
      const booking = await this.bookingService.getAdminBooking(bookingId);
      response.json({ booking });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  private handleError(error: unknown, response: Response): void {
    if (error instanceof BookingValidationError) {
      response.status(400).json({ error: error.message, issues: error.issues });
      return;
    }

    if (error instanceof BookingNotFoundError) {
      response.status(404).json({ error: error.message });
      return;
    }

    throw error;
  }
}
