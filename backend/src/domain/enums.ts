export enum UserRole {
  Driver = "driver",
  Admin = "admin",
}

export enum AccountStatus {
  Active = "active",
  Disabled = "disabled",
  Pending = "pending",
}

export enum SpotStatus {
  Available = "available",
  Occupied = "occupied",
  Reserved = "reserved",
  MaintenanceRequired = "maintenanceRequired",
}

export enum BookingStatus {
  Pending = "pending",
  Confirmed = "confirmed",
  Cancelled = "cancelled",
  Expired = "expired",
  Completed = "completed",
}

export enum SubscriptionType {
  Daily = "daily",
  Weekly = "weekly",
  Monthly = "monthly",
}

export enum IncidentStatus {
  Open = "open",
  InReview = "inReview",
  Resolved = "resolved",
}

export enum NotificationType {
  BookingConfirmation = "bookingConfirmation",
  BookingReminder = "bookingReminder",
  AccountStatus = "accountStatus",
}

export enum DetectionEventType {
  VehicleEntry = "vehicleEntry",
  VehicleExit = "vehicleExit",
}
