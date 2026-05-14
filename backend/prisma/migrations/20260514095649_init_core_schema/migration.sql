-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('driver', 'admin');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'disabled', 'pending');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'expired', 'cancelled', 'pending');

-- CreateEnum
CREATE TYPE "SpotStatus" AS ENUM ('available', 'occupied', 'reserved', 'maintenanceRequired');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'expired', 'completed');

-- CreateEnum
CREATE TYPE "DetectionEventType" AS ENUM ('vehicleEntry', 'vehicleExit');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('bookingConfirmation', 'bookingReminder', 'accountStatus');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'read');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'inReview', 'resolved');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'driver',
    "account_status" "AccountStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "license_plate" TEXT NOT NULL,
    "vehicle_make" TEXT,
    "vehicle_model" TEXT,
    "vehicle_color" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "SubscriptionType" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'pending',
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "distance_from_entry_meters" INTEGER,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_spots" (
    "id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "spot_code" TEXT NOT NULL,
    "status" "SpotStatus" NOT NULL DEFAULT 'available',
    "level" TEXT,
    "row_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_spots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "spot_id" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detection_events" (
    "id" TEXT NOT NULL,
    "spot_id" TEXT NOT NULL,
    "type" "DetectionEventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detection_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occupancy_history" (
    "id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "available_spots" INTEGER NOT NULL,
    "occupied_spots" INTEGER NOT NULL,
    "reserved_spots" INTEGER NOT NULL DEFAULT 0,
    "occupancy_rate" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occupancy_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "spot_id" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "issue_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_university_id_key" ON "users"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_profiles_license_plate_key" ON "vehicle_profiles"("license_plate");

-- CreateIndex
CREATE INDEX "vehicle_profiles_user_id_idx" ON "vehicle_profiles"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "parking_zones_name_key" ON "parking_zones"("name");

-- CreateIndex
CREATE INDEX "parking_zones_display_order_idx" ON "parking_zones"("display_order");

-- CreateIndex
CREATE INDEX "parking_spots_zone_id_idx" ON "parking_spots"("zone_id");

-- CreateIndex
CREATE INDEX "parking_spots_status_idx" ON "parking_spots"("status");

-- CreateIndex
CREATE UNIQUE INDEX "parking_spots_zone_id_spot_code_key" ON "parking_spots"("zone_id", "spot_code");

-- CreateIndex
CREATE INDEX "bookings_user_id_idx" ON "bookings"("user_id");

-- CreateIndex
CREATE INDEX "bookings_spot_id_start_time_end_time_idx" ON "bookings"("spot_id", "start_time", "end_time");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "detection_events_spot_id_idx" ON "detection_events"("spot_id");

-- CreateIndex
CREATE INDEX "detection_events_occurred_at_idx" ON "detection_events"("occurred_at");

-- CreateIndex
CREATE INDEX "occupancy_history_zone_id_recorded_at_idx" ON "occupancy_history"("zone_id", "recorded_at");

-- CreateIndex
CREATE INDEX "occupancy_history_recorded_at_idx" ON "occupancy_history"("recorded_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_booking_id_idx" ON "notifications"("booking_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "incident_reports_user_id_idx" ON "incident_reports"("user_id");

-- CreateIndex
CREATE INDEX "incident_reports_spot_id_idx" ON "incident_reports"("spot_id");

-- CreateIndex
CREATE INDEX "incident_reports_status_idx" ON "incident_reports"("status");

-- AddForeignKey
ALTER TABLE "vehicle_profiles" ADD CONSTRAINT "vehicle_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_spots" ADD CONSTRAINT "parking_spots_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "parking_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "parking_spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_events" ADD CONSTRAINT "detection_events_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "parking_spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancy_history" ADD CONSTRAINT "occupancy_history_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "parking_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "parking_spots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
