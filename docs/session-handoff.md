# Session Handoff

## Completed

- Phase 01 complete.
- Phase 02 complete.
- Phase 03 completed through Step 19:
  - 3.1 Parking Zone repository/service
  - 3.2 Admin Parking Zone routes
  - 3.3 Parking Spot repository/service
  - 3.4 Admin Parking Spot routes
  - 3.5 Zone Capacity Consistency Rules
  - 3.6 Detection Event Ingestion Service
  - 3.7 Detection Event Routes
  - 3.8 Occupancy Snapshot and History Service
  - 3.9 Monitoring Read Routes
  - 3.10 Real-Time Event Channel Skeleton
  - 3.11 Frontend Parking API Clients
  - 3.12 Admin Parking Inventory UI Shell
  - 3.13 Admin Parking Zone Forms UI
  - 3.14 Admin Parking Spot Forms UI
  - 3.15 Dashboard Availability UI
  - 3.16 Parking Map UI
  - 3.17 Simulated Sensor Admin UI
  - 3.18 Real-Time Dashboard Refresh
  - 3.19 Phase 03 End-to-End Verification

## Backend State

- Express + Prisma backend.
- Parking zone service/routes now exist.
- Parking spot service/routes now exist.
- Detection event ingestion service now exists.
- Admin detection event routes now exist.
- Occupancy summary/history service now exists.
- Authenticated occupancy read routes now exist.
- Authenticated parking event SSE route now exists.
- Auth required for read routes:
  - `GET /api/parking-zones`
  - `GET /api/parking-spots`
  - `GET /api/parking-zones/:zoneId/parking-spots`
- Admin-only mutation routes:
  - `POST/PATCH/DELETE /api/admin/parking-zones`
  - `POST/PATCH/DELETE /api/admin/parking-spots`
  - `POST /api/admin/detection-events`
- Admin-only read routes:
  - `GET /api/admin/detection-events`
- Authenticated driver/admin monitoring routes:
  - `GET /api/occupancy/summary`
  - `GET /api/occupancy/zones/:zoneId`
  - `GET /api/parking-events`
- Controlled errors implemented for validation `400`, auth `401`, role `403`, not found `404`, duplicate `409`, and detection-event reserved-spot conflicts.

## Frontend State

- Phase 2 UI shell exists with auth/account/admin screens.
- Recent design-system sidebar/layout fixes applied.
- Driver/admin sidebar now uses fixed nav groups plus flexible spacer.
- Phase 3 parking API clients now exist for zones, spots, occupancy, and detection events.
- Admin parking inventory UI shell now exists for read-only zones and spots, with loading, empty, error, ready, and permission states.
- Admin parking zone create/edit/delete forms now exist, with validation, confirmation, success, and conflict/error messages.
- Admin parking spot create/edit/delete forms now exist, with zone selection, status selection, optional level/row label fields, validation, confirmation, success, and conflict/error messages.
- Driver/admin dashboard now shows real occupancy summary data, campus capacity, available spots, occupied/reserved counts, zone availability rows, and loading/empty/error states.
- Driver parking map now shows zone-filtered spot tiles, readable status labels, a legend, selected spot details, and loading/empty/error states.
- Admin sensor simulator now posts simulated `vehicleEntry`/`vehicleExit` events, shows updated spot status, lists recent detection events, and denies driver access.
- Dashboard and parking map now subscribe to authenticated parking update events and fall back to 3-second polling if the stream disconnects.
- Phase 03 end-to-end verification now covers admin parking zone CRUD, admin parking spot CRUD, role restrictions, driver dashboard/map reads, detection event ingestion, occupancy counts, SSE refresh within 3 seconds, health checks, and Phase 4/5 route absence.

## Architecture Decisions

- `ParkingZone.capacity` is manually managed.
- Capacity consistency rules prevent spot count from exceeding zone capacity and prevent shrinking capacity below existing spot count.
- `ParkingSpot.spotCode` uniqueness follows Prisma constraint: unique only within `(zoneId, spotCode)`.
- Simulated detection events update spot status: `vehicleEntry` -> `occupied`, `vehicleExit` -> `available`.
- Detection events for `reserved` spots are rejected; sensor overrides for reservations are not enabled.
- Occupancy rate includes occupied and reserved spots.
- `maintenanceRequired` spots are unavailable but not counted as occupied.
- Detection events broadcast SSE `parking-update` events after spot status changes.
- Read inventory routes are authenticated for driver dashboard/map use.
- Admin inventory mutation routes require `requireRole("admin")`.
- Detection event routes are admin-only because posting events mutates parking state.
- No booking, reservation override, recommendations, predictions, incidents, or analytics logic introduced yet.

## Active Files

- `backend/src/repositories/parkingZoneRepository.ts`
- `backend/src/services/parkingZoneService.ts`
- `backend/src/controllers/parkingZoneController.ts`
- `backend/src/routes/parkingZones.ts`
- `backend/src/repositories/parkingSpotRepository.ts`
- `backend/src/services/parkingSpotService.ts`
- `backend/src/controllers/parkingSpotController.ts`
- `backend/src/routes/parkingSpots.ts`
- `backend/src/repositories/detectionEventRepository.ts`
- `backend/src/services/detectionEventService.ts`
- `backend/src/controllers/detectionEventController.ts`
- `backend/src/routes/detectionEvents.ts`
- `backend/src/repositories/occupancyRepository.ts`
- `backend/src/services/occupancyService.ts`
- `backend/src/controllers/occupancyController.ts`
- `backend/src/routes/occupancy.ts`
- `backend/src/realtime/parkingEvents.ts`
- `backend/src/routes/parkingEvents.ts`
- `backend/src/index.ts`
- `backend/tests/detectionEventService.test.mjs`
- `backend/tests/detectionEventRoutes.test.mjs`
- `backend/tests/occupancyService.test.mjs`
- `backend/tests/occupancyRoutes.test.mjs`
- `backend/tests/parkingEvents.test.mjs`
- `backend/tests/parkingInventoryRules.test.mjs`
- `backend/tests/parkingZoneService.test.mjs`
- `backend/tests/parkingZoneRoutes.test.mjs`
- `backend/tests/parkingSpotService.test.mjs`
- `backend/tests/parkingSpotRoutes.test.mjs`
- `backend/tests/phase02.e2e.test.mjs`
- `backend/tests/phase03.e2e.test.mjs`
- `frontend/src/services/parkingZonesApi.ts`
- `frontend/src/services/parkingSpotsApi.ts`
- `frontend/src/services/occupancyApi.ts`
- `frontend/src/services/detectionEventsApi.ts`
- `frontend/src/services/parkingEventsApi.ts`
- `frontend/src/features/admin/AdminParkingInventoryPage.tsx`
- `frontend/src/features/admin/AdminSensorEventsPage.tsx`
- `frontend/src/features/parking/ParkingDashboardPage.tsx`
- `frontend/src/features/parking/ParkingMapPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/styles/global.css`
- `frontend/tests/parkingApi.test.ts`
- `frontend/tests/adminParkingInventoryUi.test.ts`
- `frontend/tests/adminParkingZoneUi.test.ts`
- `frontend/tests/adminParkingSpotUi.test.ts`
- `frontend/tests/parkingDashboardUi.test.ts`
- `frontend/tests/parkingMapUi.test.ts`
- `frontend/tests/adminSensorEventsUi.test.ts`
- `frontend/tests/parkingRealtime.test.ts`

## Pending Work

- Next: Phase 04.
- Do not start recommendations, predictions, incidents, or analytics until their phase asks for them.

## Unresolved Issues

- None blocking.
- Local backend tests require Postgres running on `127.0.0.1:55432` and `DATABASE_URL=postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test`.
- Some generated `backend/dist/*` files appear because backend build emits compiled JS.

## Styling / Design System

- Follow `docs/design-system.md`.
- Use Figma file `FVGqaI2s3CA30njK7B98wV` when frontend work starts.
- Sidebar must stay fixed `180px`, white, border `#e0e5ed`, fixed `8px` nav gaps, Settings/Logout bottom, no stretched nav items.
- Use Australian spelling in UI, especially `licence plate`.
- UI status colours must always include readable text labels.

## Build / Test Status

- Backend `npm test`: passed, 129 tests after Phase 03 end-to-end verification.
- Frontend `npm run build`: passed after Phase 03 end-to-end verification.
- Frontend `npm test`: passed, 74 tests.

## Next Exact Task

Start Phase 04 from its first step. Do not start recommendations, predictions, incidents, or analytics work yet.
