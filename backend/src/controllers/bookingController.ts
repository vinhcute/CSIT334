import type { Request, Response } from "express";
import {
  BookingAccountDisabledError,
  BookingCancellationConflictError,
  BookingConflictError,
  BookingNotFoundError,
  BookingService,
  BookingSpotMaintenanceConflictError,
  BookingSpotNotFoundError,
  BookingSpotOccupiedConflictError,
  BookingSubscriptionEligibilityError,
  BookingUserNotFoundError,
  BookingValidationError,
} from "../services/bookingService.js";

export class BookingController {
  constructor(private readonly bookingService = new BookingService()) {}

  indexMine = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const bookings = await this.bookingService.listMyBookings(request.user.userId);
      response.json({ bookings });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  showMine = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const bookingId = typeof request.params.id === "string" ? request.params.id : "";
      const booking = await this.bookingService.getMyBooking(request.user.userId, bookingId);
      response.json({ booking });
    } catch (error) {
      this.handleError(error, response);
    }
  };

  create = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const result = await this.bookingService.createBooking(request.user.userId, request.body);
      response.status(201).json(result);
    } catch (error) {
      this.handleError(error, response);
    }
  };

  cancel = async (request: Request, response: Response): Promise<void> => {
    if (!request.user) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const bookingId =
        typeof request.params.id === "string" ? request.params.id : "";
      const result = await this.bookingService.cancelBooking(
        request.user.userId,
        bookingId,
      );
      response.json(result);
    } catch (error) {
      this.handleError(error, response);
    }
  };

  private handleError(error: unknown, response: Response): void {
    if (error instanceof BookingValidationError) {
      response.status(400).json({ error: error.message, issues: error.issues });
      return;
    }

    if (
      error instanceof BookingUserNotFoundError ||
      error instanceof BookingSpotNotFoundError ||
      error instanceof BookingNotFoundError
    ) {
      response.status(404).json({ error: error.message });
      return;
    }

    if (
      error instanceof BookingAccountDisabledError ||
      error instanceof BookingSubscriptionEligibilityError
    ) {
      response.status(403).json({ error: error.message });
      return;
    }

    if (
      error instanceof BookingConflictError ||
      error instanceof BookingSpotMaintenanceConflictError ||
      error instanceof BookingSpotOccupiedConflictError ||
      error instanceof BookingCancellationConflictError
    ) {
      response.status(409).json({ error: error.message });
      return;
    }

    throw error;
  }
}
