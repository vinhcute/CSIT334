import { createApiClient } from "./apiClient.js";
import type { ZoneOccupancySummary } from "./occupancyApi.js";
import type { ParkingSpotStatus } from "./parkingSpotsApi.js";

export interface ParkingUpdateEvent {
  spotId: string;
  zoneId: string;
  status: ParkingSpotStatus;
  zoneSummary: ZoneOccupancySummary;
}

export interface ParkingEventsSubscription {
  onUpdate: (event: ParkingUpdateEvent) => void;
  onDisconnect?: (error?: unknown) => void;
}

export type ParkingEventsApiClient = Pick<ReturnType<typeof createApiClient>, "getToken">;

export function createParkingEventsApi(
  apiClient: ParkingEventsApiClient = createApiClient(),
  fetchImpl: typeof fetch = fetch,
) {
  return {
    subscribeToParkingUpdates({
      onDisconnect,
      onUpdate,
    }: ParkingEventsSubscription): () => void {
      const abortController = new AbortController();

      void connectParkingEventStream({
        apiClient,
        fetchImpl,
        onDisconnect,
        onUpdate,
        signal: abortController.signal,
      });

      return () => abortController.abort();
    },
  };
}

export async function connectParkingEventStream({
  apiClient,
  fetchImpl,
  onDisconnect,
  onUpdate,
  signal,
}: ParkingEventsSubscription & {
  apiClient: ParkingEventsApiClient;
  fetchImpl: typeof fetch;
  signal: AbortSignal;
}): Promise<void> {
  try {
    const headers = new Headers();
    const token = apiClient.getToken();

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const response = await fetchImpl("/api/parking-events", {
      headers,
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error("Unable to connect to parking event stream.");
    }

    await readParkingEventStream(response.body, onUpdate, signal);

    if (!signal.aborted) {
      onDisconnect?.();
    }
  } catch (error) {
    if (!signal.aborted) {
      onDisconnect?.(error);
    }
  }
}

export async function readParkingEventStream(
  stream: ReadableStream<Uint8Array>,
  onUpdate: (event: ParkingUpdateEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = consumeParkingEventBuffer(buffer, onUpdate);
    }
  } finally {
    reader.releaseLock();
  }
}

export function consumeParkingEventBuffer(
  buffer: string,
  onUpdate: (event: ParkingUpdateEvent) => void,
): string {
  const messages = buffer.split("\n\n");
  const remainder = messages.pop() ?? "";

  for (const message of messages) {
    const update = parseParkingUpdateMessage(message);

    if (update) {
      onUpdate(update);
    }
  }

  return remainder;
}

export function parseParkingUpdateMessage(message: string): ParkingUpdateEvent | null {
  if (!message.includes("event: parking-update")) {
    return null;
  }

  const dataLine = message.split("\n").find((line) => line.startsWith("data: "));

  if (!dataLine) {
    return null;
  }

  const parsed = JSON.parse(dataLine.slice("data: ".length)) as ParkingUpdateEvent;

  return parsed;
}
