import { SpotStatus } from "@prisma/client";
import { parkingEvents } from "../realtime/parkingEvents.js";
import { BookingRepository } from "../repositories/bookingRepository.js";
import { OccupancyService } from "./occupancyService.js";

export interface ExpireDueBookingsResult {
  scanned: number;
  expired: number;
  releasedSpots: number;
}

export class BookingExpirationService {
  constructor(
    private readonly bookingRepository = new BookingRepository(),
    private readonly occupancyService = new OccupancyService(),
    private readonly parkingEventStream: Pick<
      typeof parkingEvents,
      "broadcastParkingUpdate"
    > = parkingEvents,
  ) {}

  async expireDueBookings(now = new Date()): Promise<ExpireDueBookingsResult> {
    const dueBookings = await this.bookingRepository.findExpirableBookings(now);
    let expired = 0;
    let releasedSpots = 0;

    for (const booking of dueBookings) {
      const expiredBooking = await this.bookingRepository.expireBooking(booking.id);
      expired += 1;

      const shouldReleaseSpot = expiredBooking.spot.status === SpotStatus.reserved;

      if (!shouldReleaseSpot) {
        continue;
      }

      const otherActiveCount = await this.bookingRepository.countActiveBlockingBookingsForSpot(
        expiredBooking.spotId,
        expiredBooking.id,
      );

      if (otherActiveCount > 0) {
        continue;
      }

      const releasedSpot = await this.bookingRepository.updateSpotStatus(
        expiredBooking.spotId,
        SpotStatus.available,
      );
      releasedSpots += 1;

      const zoneSummary = await this.occupancyService.getZoneDetail(releasedSpot.zoneId);
      this.parkingEventStream.broadcastParkingUpdate({
        spotId: releasedSpot.id,
        zoneId: releasedSpot.zoneId,
        status: releasedSpot.status,
        zoneSummary,
      });
    }

    return {
      scanned: dueBookings.length,
      expired,
      releasedSpots,
    };
  }
}
