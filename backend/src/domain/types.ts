import type {
  AccountStatus,
  BookingStatus,
  DetectionEventType,
  IncidentStatus,
  NotificationType,
  SpotStatus,
  SubscriptionType,
  UserRole,
} from "./enums.js";

export type EntityId = string;
export type UserId = EntityId;
export type VehicleProfileId = EntityId;
export type ParkingZoneId = EntityId;
export type ParkingSpotId = EntityId;
export type BookingId = EntityId;
export type DetectionEventId = EntityId;
export type OccupancyHistoryId = EntityId;
export type NotificationId = EntityId;
export type IncidentReportId = EntityId;

export interface TimeWindow {
  startTime: Date;
  endTime: Date;
}

export interface AuditableTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface UserIdentity {
  id: UserId;
  role: UserRole;
  accountStatus: AccountStatus;
}

export interface ParkingSpotState {
  parkingSpotId: ParkingSpotId;
  spotStatus: SpotStatus;
}

export interface BookingWindow extends TimeWindow {
  bookingId: BookingId;
  bookingStatus: BookingStatus;
}

export interface SubscriptionWindow extends TimeWindow {
  subscriptionType: SubscriptionType;
}

export interface DetectionEventSummary {
  detectionEventId: DetectionEventId;
  parkingSpotId: ParkingSpotId;
  detectionEventType: DetectionEventType;
  occurredAt: Date;
}

export interface NotificationSummary {
  notificationId: NotificationId;
  userId: UserId;
  notificationType: NotificationType;
}

export interface IncidentReportStateSummary {
  incidentReportId: IncidentReportId;
  incidentStatus: IncidentStatus;
}
