import type { Response } from "express";
import type { ZoneOccupancySummary } from "../services/occupancyService.js";

export interface ParkingUpdateEvent {
  spotId: string;
  zoneId: string;
  status: string;
  zoneSummary: ZoneOccupancySummary;
}

class ParkingEventStream {
  private readonly clients = new Set<Response>();

  subscribe(response: Response): () => void {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders?.();
    response.write(": connected\n\n");

    this.clients.add(response);

    return () => {
      this.clients.delete(response);
    };
  }

  broadcastParkingUpdate(event: ParkingUpdateEvent): void {
    this.broadcast("parking-update", event);
  }

  private broadcast(eventName: string, payload: unknown): void {
    const message = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const client of this.clients) {
      client.write(message);
    }
  }
}

export const parkingEvents = new ParkingEventStream();
