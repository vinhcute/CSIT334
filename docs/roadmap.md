# MVP Development Roadmap

This roadmap sequences the Smart Parking Management System by technical dependency. Build each phase in order so later UI, booking, prediction, and analytics features have stable domain models, authentication, and data flows underneath them.

## Phase 01: Foundation, Domain Model, and Seed Data

Outcome: Establish the project skeleton, core backend architecture, database schema, and domain vocabulary before building user-facing workflows. By the end of this phase, the system should have reliable models for users, vehicles, subscriptions, parking zones, parking spots, bookings, occupancy history, sensor events, notifications, and incident reports.

Core features:

- Repository structure for `frontend/`, `backend/`, `database/`, `scripts/`, and `docs/`.
- Backend modular structure for controllers, services, repositories, domain models, routes, middleware, and real-time modules.
- Database schema for users, vehicle profiles, subscriptions, parking zones, parking spots, bookings, occupancy history, detection events, notifications, and incident reports.
- Domain enums for `spotStatus`, `bookingStatus`, `accountStatus`, user roles, subscription types, and incident status.
- Seed-data scripts for demo users, admins, vehicles, zones, spots, bookings, sensor events, occupancy history, notifications, and incident reports.
- Basic health-check endpoint and database connection verification.

## Phase 02: Authentication, Accounts, and Role Access

Outcome: Add secure identity and access control so every later feature can rely on known users and roles. Drivers and admins should be able to enter the system safely, while sensitive user and vehicle data remains protected.

Core features:

- Driver registration with name, university ID, email, password, and licence plate details.
- Secure login and logout.
- Password hashing and basic session or token handling.
- Role-based access control for `driver` and `admin`.
- Current-user profile endpoint and protected-route middleware.
- Simulated subscription purchase or renewal for daily, weekly, and monthly permits.
- Password reset or password change flow.
- Admin account disable and reactivation workflow.
- Sensitive-data handling rules for university IDs, session tokens, and licence plates.

## Phase 03: Parking Inventory and Real-Time Monitoring

Outcome: Build the live parking foundation that all booking, recommendation, prediction, and analytics features depend on. Admins should be able to manage parking inventory, and users should see current campus parking availability through a dashboard and map.

Core features:

- Admin CRUD for parking zones.
- Admin CRUD for parking spots assigned to parking zones.
- Spot status state management for `available`, `occupied`, `reserved`, and `maintenanceRequired`.
- Simulated sensor feed ingestion for vehicle entry and exit events.
- Detection event storage and processing.
- Real-time dashboard showing total capacity and available spots by zone.
- Visual parking map or zone representation.
- Real-time dashboard/map updates without manual refresh.
- Accessible status indicators using both colour and text labels.

## Phase 04: Booking and Reservation Workflows

Outcome: Add the core driver workflow for reserving parking while enforcing consistency between bookings and spot state. This phase turns live availability into a usable parking service by preventing conflicts, handling cancellations, and expiring unused reservations.

Core features:

- Driver booking creation for a specific parking spot and future booking window.
- Booking conflict validation for overlapping spot reservations.
- Spot transition to `reserved` for confirmed booking windows.
- Driver view for current and past bookings.
- Driver cancellation for eligible upcoming bookings.
- Automated booking expiration and spot release after the grace period.
- Booking confirmation notification or in-app message.
- Booking reminder notification or in-app message.
- Admin view of all bookings with filters by date, status, user, or zone.

## Phase 05: Smart Features, Incidents, and Admin Analytics

Outcome: Layer the "smart" and reporting capabilities on top of stable parking, booking, and historical data. This phase completes the MVP by adding recommendations, simple prediction, incident handling, and admin reporting without drifting into out-of-scope AI or hardware features.

Core features:

- Nearest available zone recommendation from a selected or assumed campus entry point.
- Least congested zone recommendation based on current occupancy rate.
- Basic predictive availability for a selected zone and future time.
- Occupancy history aggregation for prediction and analytics.
- Admin analytics dashboard with occupancy trends.
- Peak-hour visualisation.
- Utilisation statistics by parking zone.
- User incident reporting for spot discrepancies and parking issues.
- `maintenanceRequired` flagging for affected parking spots.
- Admin incident review and resolution workflow.
- Account-status notification when an account is disabled or reactivated.

## Sequencing Notes

- Do not start booking workflows before parking zones, parking spots, spot statuses, and authentication are working.
- Do not start recommendations, prediction, or analytics before real-time monitoring and occupancy history exist.
- Keep physical IoT sensors, custom AI vehicle detection, real payments, native mobile apps, SMS gateways, and advanced business intelligence outside the MVP.
