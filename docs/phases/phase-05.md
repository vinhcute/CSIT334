# Phase 05: Smart Features, Incidents, and Admin Analytics

Use this phase to add MVP smart recommendations, simple prediction, incident handling, and admin analytics on top of the completed Phase 03 parking inventory and real-time monitoring foundation.

Do not implement Phase 05 from this document until the teammate is working on the intended Phase 05 branch.

## Current Code Reality

- Phase 01, Phase 02, and Phase 03 are complete.
- Phase 04 booking and reservation workflows are being developed separately on another branch.
- Backend stack is Node.js, TypeScript, Express, Prisma, and PostgreSQL.
- Frontend stack is React, TypeScript, and Vite.
- Existing backend route mounting happens in `backend/src/index.ts`.
- Existing backend architecture uses:
  - controllers in `backend/src/controllers/`
  - services in `backend/src/services/`
  - repositories in `backend/src/repositories/`
  - route factories in `backend/src/routes/`
  - auth middleware in `backend/src/middleware/authMiddleware.ts`
  - admin role guard in `backend/src/middleware/requireRole.ts`
- Existing authenticated parking/monitoring routes:
  - `GET /api/parking-zones`
  - `GET /api/parking-spots`
  - `GET /api/parking-zones/:zoneId/parking-spots`
  - `GET /api/occupancy/summary`
  - `GET /api/occupancy/zones/:zoneId`
  - `GET /api/parking-events`
- Existing admin parking routes:
  - `POST/PATCH/DELETE /api/admin/parking-zones`
  - `POST/PATCH/DELETE /api/admin/parking-spots`
  - `GET/POST /api/admin/detection-events`
- Existing frontend shell is in `frontend/src/App.tsx`.
- Existing Phase 03 frontend files include:
  - `frontend/src/features/parking/ParkingDashboardPage.tsx`
  - `frontend/src/features/parking/ParkingMapPage.tsx`
  - `frontend/src/features/admin/AdminParkingInventoryPage.tsx`
  - `frontend/src/features/admin/AdminSensorEventsPage.tsx`
  - `frontend/src/services/occupancyApi.ts`
  - `frontend/src/services/parkingZonesApi.ts`
  - `frontend/src/services/parkingSpotsApi.ts`
  - `frontend/src/services/detectionEventsApi.ts`
  - `frontend/src/services/parkingEventsApi.ts`
- Prisma already has these Phase 05-relevant models and enums:
  - `ParkingZone`: `id`, `name`, `description`, `capacity`, `distanceFromEntryMeters`, `displayOrder`, timestamps.
  - `ParkingSpot`: `id`, `zoneId`, `spotCode`, `status`, `level`, `rowLabel`, timestamps.
  - `OccupancyHistory`: `id`, `zoneId`, `recordedAt`, `capacity`, `availableSpots`, `occupiedSpots`, `reservedSpots`, `occupancyRate`, `createdAt`.
  - `DetectionEvent`: `id`, `spotId`, `type`, `occurredAt`, `rawPayload`, `createdAt`.
  - `IncidentReport`: `id`, `userId`, optional `spotId`, `status`, `issueType`, `description`, optional `resolution`, optional `resolvedAt`, timestamps.
  - `Notification`: `id`, `userId`, optional `bookingId`, `type`, `status`, `title`, `message`, optional `sentAt`, optional `readAt`, timestamps.
  - `SpotStatus`: `available`, `occupied`, `reserved`, `maintenanceRequired`.
  - `IncidentStatus`: `open`, `inReview`, `resolved`.
  - `NotificationType`: `bookingConfirmation`, `bookingReminder`, `accountStatus`.
- `AdminUserService` already creates account-status notification records when admins disable or reactivate users.
- There are currently no recommendation, prediction, analytics, or incident service/controller/route/frontend implementations.

## Phase 04 Branch Safety

Phase 04 owns booking and reservation workflows. Phase 05 must not modify or depend heavily on unfinished Phase 04 code.

Avoid touching:

- booking Prisma schema
- booking enums
- booking conflict logic
- booking services
- booking routes
- reservation state transitions
- automated booking expiry logic
- booking notification implementation
- booking UI screens except for non-invasive display placeholders marked as TODO after Phase 04 merge

Safe Phase 05 work should mainly build on:

- `ParkingZone`
- `ParkingSpot`
- `OccupancyHistory`
- `DetectionEvent`
- existing occupancy summary APIs
- existing Phase 03 real-time monitoring data
- existing `IncidentReport` and `Notification` models
- existing admin/driver shells

If a feature would benefit from booking data later, add a TODO integration note instead of implementing against unfinished Phase 04 routes.

## Short Verification Loops

Every step below is intentionally small. Do not continue to later steps on top of failing builds or tests.

Backend verification loop:

```sh
cd backend
npm run build
npm test
```

Frontend verification loop:

```sh
cd frontend
npm run build
npm test
```

Use the local test database described in `docs/session-handoff.md` when backend tests need PostgreSQL:

```sh
cd backend
DATABASE_URL=postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test npm test
```

## Frontend Design Requirements

For every frontend UI step:

- Read `docs/design-system.md`.
- Use the built-in Figma plugin before implementation.
- Inspect the exact relevant Figma frame.
- Match the relevant frame instead of approximating from memory.
- Preserve the existing Phase 03 sidebar styling.
- Use readable text labels with colour. Do not rely on colour alone.
- Use Australian spelling in user-facing text.
- Include loading, empty, error, permission-denied, conflict, and validation states where relevant.

Relevant Figma source:

- Figma file key: `FVGqaI2s3CA30njK7B98wV`
- Driver Dashboard: node `2015:4818`
- Driver Parking Map: node `2015:4884`
- Driver Report Issue: node `2015:5234`
- Admin Analytics: node `2015:5377`
- Admin Incident Management: node `2015:5663`
- UI States: node `2015:5990`
- Form Validation: node `2015:6042`

## Step 1: Inspect Existing Smart-Feature, Incident, and Analytics Reality

### Goal

Confirm the teammate is starting from the real branch state before adding Phase 05 files.

### Files to Modify/Create

- `docs/phases/phase-05.md` only if reality has changed and the plan needs a correction.

### Required Changes/Logic

- Re-read `docs/session-handoff.md`, `docs/roadmap.md`, `docs/scope.md`, `docs/domain.md`, `docs/conventions.md`, and `docs/design-system.md`.
- Scan the real codebase before coding:
  - `backend/prisma/schema.prisma`
  - `backend/src/index.ts`
  - `backend/src/controllers/`
  - `backend/src/services/`
  - `backend/src/repositories/`
  - `backend/src/routes/`
  - `frontend/src/App.tsx`
  - `frontend/src/services/`
  - `frontend/src/features/`
  - `backend/tests/`
  - `frontend/tests/`
- Confirm whether Phase 04 has been merged. If not, follow every Phase 04 branch-safety warning in this document.

### Backend Tasks

- Verify there are still no existing recommendation, prediction, analytics, or incident route files before creating new ones.
- Verify `AdminUserService` still creates account-status notifications.

### Frontend Tasks

- Verify current sidebar route labels in `frontend/src/App.tsx`.
- Verify whether `Incidents` and `Analytics` still render `DeferredState`.

### Database/Prisma Tasks

- Confirm whether the existing `IncidentReport` and `Notification` models are still present.
- Do not create a migration in this step.

### API Routes

- None.

### Validation Rules

- None.

### Required Tests

- None new in this step.

### UI Requirements

- None.

### Success Criteria

- [ ] The teammate has confirmed Phase 04 merge status before coding.
- [ ] The teammate has confirmed current Prisma fields from `backend/prisma/schema.prisma`.
- [ ] The teammate has confirmed current backend route mounts in `backend/src/index.ts`.
- [ ] The teammate has confirmed current frontend shell sections in `frontend/src/App.tsx`.
- [ ] No implementation files are changed in this step.

### Out-of-Scope Warnings

- Do not implement Phase 05 in the inspection step.
- Do not add booking integration points unless Phase 04 has merged.

### Phase 04 Dependency Notes

- If Phase 04 is not merged, assume booking APIs and booking UI are unavailable.

## Step 2: Define Shared Phase 05 DTOs and Types Without Booking Contracts

### Goal

Create backend TypeScript interfaces for Phase 05 response shapes so services, controllers, and tests use stable contracts.

### Files to Modify/Create

- `backend/src/domain/phase05.ts`
- `backend/src/domain/index.ts`
- `backend/tests/phase05Types.test.mjs` if the team wants a lightweight compile/import guard.

### Required Changes/Logic

- Define DTOs/interfaces for:
  - `ZoneRecommendation`
  - `RecommendationResponse`
  - `PredictiveAvailabilityResult`
  - `OccupancyTrendPoint`
  - `PeakHourSummary`
  - `ZoneUtilisationSummary`
  - `AnalyticsSummary`
  - `IncidentReportSummary`
  - `IncidentReportDetail`
- Keep these types independent from Phase 04 booking contracts.
- Use current schema field names only.
- Keep response DTOs free of `passwordHash`, tokens, university IDs, and full licence plates.

### Backend Tasks

- Export new DTOs from `backend/src/domain/index.ts`.
- Keep DTOs framework-free; no Express or Prisma imports unless unavoidable.

### Frontend Tasks

- None.

### Database/Prisma Tasks

- None.

### API Routes

- None.

### Validation Rules

- None yet.

### Required Tests

- Add an import/compile smoke test only if useful.
- Run backend verification loop.

### UI Requirements

- None.

### Success Criteria

- [ ] Phase 05 DTOs exist in `backend/src/domain/phase05.ts`.
- [ ] DTOs do not import or expose booking-specific service contracts.
- [ ] DTOs do not include sensitive user fields.
- [ ] Backend build passes.
- [ ] Backend tests pass.

### Out-of-Scope Warnings

- Do not define booking DTOs here.
- Do not define reservation transition types here.

### Phase 04 Dependency Notes

- If Phase 04 later exposes booking counts for analytics, add a separate TODO after Phase 04 merge.

## Step 3: Build Recommendation Service for Nearest Available Zone

### Goal

Recommend the closest parking zone that currently has at least one available spot.

### Files to Modify/Create

- `backend/src/repositories/recommendationRepository.ts`
- `backend/src/services/recommendationService.ts`
- `backend/tests/recommendationService.test.mjs`

### Required Changes/Logic

- Use `ParkingZone.distanceFromEntryMeters` for nearest-zone sorting.
- Use current parking spot statuses from `ParkingSpot`.
- Only recommend zones where available spot count is greater than `0`.
- If `distanceFromEntryMeters` is `null`, place that zone after zones with known distances.
- Tie-break by `displayOrder`, then `name`.
- Include the reason in the result, such as `Nearest zone with current availability`.

### Backend Tasks

- Add repository methods that load zones with spots or zone availability summaries.
- Add `RecommendationService.getNearestAvailableZone()`.
- Reuse the same occupancy counting rules as Phase 03:
  - `available` counts as available.
  - `occupied` counts as occupied.
  - `reserved` is unavailable and included in occupancy rate.
  - `maintenanceRequired` is unavailable but not occupied.

### Frontend Tasks

- None.

### Database/Prisma Tasks

- None. `distanceFromEntryMeters` already exists on `ParkingZone`.

### API Routes

- None in this step.

### Validation Rules

- No request validation yet.

### Required Tests

- Test nearest available zone selection.
- Test occupied/reserved/maintenance-only zones are skipped.
- Test unknown distance is sorted after known distances.
- Test stable tie-break by display order and name.
- Run backend verification loop.

### UI Requirements

- None.

### Success Criteria

- [ ] Service returns the nearest zone with at least one available spot.
- [ ] Service excludes zones with zero available spots.
- [ ] Service handles `null` `distanceFromEntryMeters`.
- [ ] Service returns enough fields for UI display: zone id, name, distance, capacity, available count, occupancy rate, recommendation reason.
- [ ] Backend tests pass.

### Out-of-Scope Warnings

- Do not use map/navigation APIs.
- Do not implement turn-by-turn routing.
- Do not use booking availability windows.

### Phase 04 Dependency Notes

- Future booking-aware availability should be added only after Phase 04 merges.

## Step 4: Build Recommendation Service for Least Congested Zone

### Goal

Recommend the currently least congested zone based on Phase 03 occupancy rules.

### Files to Modify/Create

- `backend/src/repositories/recommendationRepository.ts`
- `backend/src/services/recommendationService.ts`
- `backend/tests/recommendationService.test.mjs`

### Required Changes/Logic

- Calculate congestion from current spot status:
  - congestion rate = `(occupiedSpots + reservedSpots) / capacity`.
- Require at least one available spot for the recommendation.
- Treat `maintenanceRequired` as unavailable but not occupied.
- Tie-break by higher available spot count, then lower distance, then display order, then name.

### Backend Tasks

- Add `RecommendationService.getLeastCongestedZone()`.
- Keep calculations deterministic and easy to test.

### Frontend Tasks

- None.

### Database/Prisma Tasks

- None.

### API Routes

- None in this step.

### Validation Rules

- None.

### Required Tests

- Test least congested available zone is returned.
- Test reserved spots count toward congestion.
- Test maintenance spots do not count as occupied but reduce practical availability.
- Test tie-breaks.
- Run backend verification loop.

### UI Requirements

- None.

### Success Criteria

- [ ] Service returns the available zone with the lowest congestion rate.
- [ ] Service excludes zones with no available spots.
- [ ] Service documents and tests congestion formula.
- [ ] Backend tests pass.

### Out-of-Scope Warnings

- Do not add prediction logic to recommendation service.
- Do not query bookings to infer future congestion while Phase 04 is separate.

### Phase 04 Dependency Notes

- Future booking-aware congestion may be added after Phase 04 merge.

## Step 5: Add Recommendation API Routes

### Goal

Expose authenticated recommendation endpoints for drivers and admins.

### Files to Modify/Create

- `backend/src/controllers/recommendationController.ts`
- `backend/src/routes/recommendations.ts`
- `backend/src/index.ts`
- `backend/tests/recommendationRoutes.test.mjs`

### Required Changes/Logic

- Add REST-style read endpoints:
  - `GET /api/recommendations/nearest-zone`
  - `GET /api/recommendations/least-congested-zone`
  - optional combined endpoint: `GET /api/recommendations/zones`
- Protect routes with `createAuthMiddleware()`.
- Allow both `driver` and `admin`.
- Keep controllers thin.
- Return controlled `401` for unauthenticated calls.

### Backend Tasks

- Add controller methods that call `RecommendationService`.
- Mount `createRecommendationsRouter()` in `backend/src/index.ts`.
- Ensure responses contain no sensitive user data.

### Frontend Tasks

- None.

### Database/Prisma Tasks

- None.

### API Routes

- `GET /api/recommendations/nearest-zone`
- `GET /api/recommendations/least-congested-zone`
- Optional: `GET /api/recommendations/zones`

### Validation Rules

- No required input.
- If adding optional query params later, validate them with `zod`.

### Required Tests

- Authenticated driver can call recommendation endpoints.
- Authenticated admin can call recommendation endpoints.
- Unauthenticated caller receives `401`.
- Empty/no-available-zone response is controlled and documented.
- Run backend verification loop.

### UI Requirements

- None.

### Success Criteria

- [ ] Recommendation routes are mounted.
- [ ] Driver can read nearest-zone recommendation.
- [ ] Driver can read least-congested-zone recommendation.
- [ ] Unauthenticated calls return `401`.
- [ ] Responses do not include sensitive user data.
- [ ] Backend tests pass.

### Out-of-Scope Warnings

- Do not add booking-aware recommendation logic.
- Do not add paid priority recommendations.

### Phase 04 Dependency Notes

- Keep recommendation routes independent from Phase 04 booking routes.

## Step 6: Add Frontend Recommendation API Client

### Goal

Create typed frontend clients for recommendation endpoints.

### Files to Modify/Create

- `frontend/src/services/recommendationsApi.ts`
- `frontend/tests/recommendationsApi.test.ts`

### Required Changes/Logic

- Reuse `createApiClient`.
- Add typed interfaces matching backend response shapes.
- Include API error propagation using existing `ApiError`.
- Keep UI out of this step.

### Backend Tasks

- None.

### Frontend Tasks

- Implement `createRecommendationsApi()`.
- Add methods for:
  - `getNearestZoneRecommendation()`
  - `getLeastCongestedZoneRecommendation()`
  - optional `getZoneRecommendations()`

### Database/Prisma Tasks

- None.

### API Routes

- Call routes from Step 5.

### Validation Rules

- None.

### Required Tests

- Verify endpoint paths.
- Verify auth flag is used.
- Verify response types are consumed correctly in tests.
- Run frontend verification loop.

### UI Requirements

- None.

### Success Criteria

- [ ] Recommendation API client exists.
- [ ] Client uses authenticated requests.
- [ ] Client tests pass.
- [ ] Frontend build passes.

### Out-of-Scope Warnings

- Do not render recommendation UI in this step.

### Phase 04 Dependency Notes

- Do not call booking endpoints from this API client.

## Step 7: Add Driver Recommendation UI Panel Using Existing Dashboard/Map Data

### Goal

Show smart suggestions on the driver dashboard without depending on Phase 04 booking workflows.

### Files to Modify/Create

- `frontend/src/features/parking/ParkingDashboardPage.tsx`
- `frontend/src/services/recommendationsApi.ts`
- `frontend/src/styles/global.css`
- `frontend/tests/recommendationUi.test.ts`

### Required Changes/Logic

- Read `docs/design-system.md`.
- Use the Figma plugin to inspect Driver Dashboard node `2015:4818` and UI States node `2015:5990`.
- Add a Smart Suggestions panel showing:
  - nearest available zone
  - least congested zone
  - available spot count
  - distance when known
  - reason text
- Keep any map navigation/book action as TODO text only if Phase 04 is not merged.
- Include loading, empty, error, and retry states.

### Backend Tasks

- None.

### Frontend Tasks

- Fetch recommendation API data in `ParkingDashboardPage`.
- Preserve existing dashboard occupancy summary behavior.
- Ensure text labels explain recommendation meaning.
- Do not add a booking call-to-action unless Phase 04 has merged and the team explicitly integrates it later.

### Database/Prisma Tasks

- None.

### API Routes

- Frontend calls Step 5 recommendation routes.

### Validation Rules

- None.

### Required Tests

- UI shows nearest available zone.
- UI shows least congested zone.
- UI handles no recommendation available.
- UI handles API error with retry.
- UI does not show booking creation controls when Phase 04 is not merged.
- Run frontend verification loop.

### UI Requirements

- Follow Driver Dashboard frame `2015:4818`.
- Use UI States frame `2015:5990`.
- Do not rely on colour alone.
- Keep sidebar intact.

### Success Criteria

- [ ] Driver dashboard shows nearest available zone recommendation.
- [ ] Driver dashboard shows least congested zone recommendation.
- [ ] Loading, empty, and error states are testable.
- [ ] UI matches the Figma dashboard layout.
- [ ] No Phase 04 booking dependency is introduced.
- [ ] Frontend tests pass.
- [ ] Frontend build passes.

### Out-of-Scope Warnings

- Do not implement booking from recommendations in this step.
- Do not implement map routing.

### Phase 04 Dependency Notes

- After Phase 04 merges, a follow-up may link a recommendation to a booking selection flow.

## Step 8: Build Predictive Availability Utility Using `OccupancyHistory`

### Goal

Create deterministic prediction logic that estimates future availability for a selected zone and future time using historical occupancy records.

### Files to Modify/Create

- `backend/src/repositories/predictionRepository.ts`
- `backend/src/services/predictiveAvailabilityService.ts`
- `backend/tests/predictiveAvailabilityService.test.mjs`

### Required Changes/Logic

- Query `OccupancyHistory` by `zoneId` and historical records near the target day-of-week/hour.
- Keep the algorithm simple and explainable:
  - group records by hour of day
  - prefer records matching target hour
  - calculate average available spots and average occupancy rate
  - convert to an availability probability from `0` to `100`
- If not enough history exists, return a controlled low-confidence result using current occupancy as fallback.
- Do not introduce real AI or machine-learning dependencies.

### Backend Tasks

- Add repository methods:
  - find zone by id
  - list occupancy history by zone and time window
  - list matching hour records for a zone
- Add service method:
  - `getPredictiveAvailability(zoneId, targetTime)`

### Frontend Tasks

- None.

### Database/Prisma Tasks

- None. `OccupancyHistory` already exists and has indexes by `zoneId, recordedAt`.

### API Routes

- None in this step.

### Validation Rules

- `zoneId` must be non-empty.
- `targetTime` must be a valid future date/time.
- Reject dates too far in the future if the team chooses a limit, such as 30 days.

### Required Tests

- Prediction uses matching historical hour records.
- Prediction returns probability between `0` and `100`.
- Prediction returns expected average availability for fixed fixtures.
- Missing zone returns controlled not-found error.
- Sparse history returns low-confidence fallback.
- Past target time is rejected.
- Run backend verification loop.

### UI Requirements

- None.

### Success Criteria

- [ ] Predictive availability service exists.
- [ ] Prediction is deterministic and tested with fixed fixtures.
- [ ] Sparse history fallback is controlled.
- [ ] No AI or external prediction service is introduced.
- [ ] Backend tests pass.

### Out-of-Scope Warnings

- Do not use complex ML.
- Do not include booking windows until Phase 04 merges.

### Phase 04 Dependency Notes

- Future predictions may incorporate confirmed future bookings after Phase 04 merge. Add TODO only.

## Step 9: Add Predictive Availability API Route

### Goal

Expose authenticated predictive availability for a selected parking zone and future time.

### Files to Modify/Create

- `backend/src/controllers/predictiveAvailabilityController.ts`
- `backend/src/routes/predictiveAvailability.ts`
- `backend/src/index.ts`
- `backend/tests/predictiveAvailabilityRoutes.test.mjs`

### Required Changes/Logic

- Add route:
  - `GET /api/predictions/availability?zoneId=...&targetTime=...`
- Protect with auth middleware.
- Allow both drivers and admins.
- Return controlled `400`, `401`, and `404` responses.

### Backend Tasks

- Validate query params with `zod`.
- Controller calls `PredictiveAvailabilityService`.
- Keep sensitive data out of responses.

### Frontend Tasks

- None.

### Database/Prisma Tasks

- None.

### API Routes

- `GET /api/predictions/availability`

### Validation Rules

- `zoneId` required.
- `targetTime` required and must parse to valid date.
- `targetTime` must be in the future.

### Required Tests

- Authenticated driver can get prediction.
- Authenticated admin can get prediction.
- Missing query values return `400`.
- Past target time returns `400`.
- Missing zone returns `404`.
- Unauthenticated caller receives `401`.
- Run backend verification loop.

### UI Requirements

- None.

### Success Criteria

- [ ] Prediction route is mounted.
- [ ] Valid request returns prediction result.
- [ ] Invalid request returns controlled validation response.
- [ ] Backend tests pass.

### Out-of-Scope Warnings

- Do not create booking predictions.
- Do not use booking data before Phase 04 merge.

### Phase 04 Dependency Notes

- Keep route independent of booking routes.

## Step 10: Add Frontend Predictive Availability UI

### Goal

Let drivers choose a zone and future time to view a simple availability prediction.

### Files to Modify/Create

- `frontend/src/services/predictiveAvailabilityApi.ts`
- `frontend/src/features/parking/ParkingDashboardPage.tsx`
- `frontend/src/styles/global.css`
- `frontend/tests/predictiveAvailabilityApi.test.ts`
- `frontend/tests/predictiveAvailabilityUi.test.ts`

### Required Changes/Logic

- Read `docs/design-system.md`.
- Use the Figma plugin to inspect Driver Dashboard node `2015:4818`, UI States node `2015:5990`, and Form Validation node `2015:6042`.
- Add predictive availability panel to the driver dashboard.
- Use existing parking zones from current dashboard data or call `parkingZonesApi`.
- Allow selecting a zone and date/time.
- Display:
  - availability probability
  - predicted available spots
  - confidence label
  - explanation that this is based on historical occupancy
- Add loading, empty, error, and validation states.

### Backend Tasks

- None.

### Frontend Tasks

- Add typed prediction API client.
- Add panel UI in `ParkingDashboardPage`.
- Validate required zone and future time before request.

### Database/Prisma Tasks

- None.

### API Routes

- Calls `GET /api/predictions/availability`.

### Validation Rules

- Parking zone is required.
- Future time is required.
- Future time must be after now.

### Required Tests

- API client test for endpoint path and auth.
- UI renders prediction form.
- UI blocks missing zone/time.
- UI displays prediction result.
- UI displays API error and retry/re-submit state.
- Run frontend verification loop.

### UI Requirements

- Match Driver Dashboard frame `2015:4818`.
- Use validation frame `2015:6042`.
- Keep panel compact and operational.

### Success Criteria

- [ ] Driver can request predictive availability.
- [ ] Prediction result displays probability and explanation.
- [ ] Validation errors are visible and accessible.
- [ ] Frontend tests pass.
- [ ] Frontend build passes.

### Out-of-Scope Warnings

- Do not call booking APIs.
- Do not promise guaranteed availability.

### Phase 04 Dependency Notes

- Add only TODO copy if future bookings should later influence prediction.

## Step 11: Build Occupancy Aggregation Service for Admin Analytics

### Goal

Aggregate `OccupancyHistory` into admin-friendly trend, peak-hour, and utilisation summaries.

### Files to Modify/Create

- `backend/src/repositories/analyticsRepository.ts`
- `backend/src/services/analyticsService.ts`
- `backend/tests/analyticsService.test.mjs`

### Required Changes/Logic

- Use `OccupancyHistory` records.
- Provide:
  - occupancy trend points by time bucket
  - peak-hour summaries
  - utilisation statistics by parking zone
- Support filters:
  - optional `zoneId`
  - optional `from`
  - optional `to`
  - optional `bucket` such as `hour` or `day`
- Keep calculations deterministic.
- Do not require booking data.

### Backend Tasks

- Repository loads history records with zone metadata.
- Service groups records in application code unless Prisma query aggregation remains simple and readable.
- Calculate:
  - average occupancy rate
  - average available spots
  - average occupied spots
  - average reserved spots
  - peak hour by highest average occupancy rate
  - utilisation by zone

### Frontend Tasks

- None.

### Database/Prisma Tasks

- None unless query performance requires an additional index. If a migration is truly needed, wait until Phase 04 schema work is merged and coordinate one branch owner for migrations.

### API Routes

- None in this step.

### Validation Rules

- Validate filters in service tests if service accepts raw input.
- `from` must be before `to`.
- Bucket must be one of supported values.

### Required Tests

- Aggregates hourly trends from fixed fixtures.
- Aggregates daily trends if implemented.
- Calculates peak hours correctly.
- Calculates zone utilisation correctly.
- Rejects invalid filter windows.
- Run backend verification loop.

### UI Requirements

- None.

### Success Criteria

- [ ] Analytics service returns trend points.
- [ ] Analytics service returns peak-hour data.
- [ ] Analytics service returns utilisation by zone.
- [ ] Booking data is not required.
- [ ] Backend tests pass.

### Out-of-Scope Warnings

- Do not build advanced BI.
- Do not introduce external analytics platforms.

### Phase 04 Dependency Notes

- Booking-based analytics should wait until Phase 04 merge.

## Step 12: Add Admin Analytics API Routes

### Goal

Expose admin-only analytics endpoints.

### Files to Modify/Create

- `backend/src/controllers/analyticsController.ts`
- `backend/src/routes/analytics.ts`
- `backend/src/index.ts`
- `backend/tests/analyticsRoutes.test.mjs`

### Required Changes/Logic

- Add admin-only endpoints:
  - `GET /api/admin/analytics/occupancy-trends`
  - `GET /api/admin/analytics/peak-hours`
  - `GET /api/admin/analytics/zone-utilisation`
  - optional combined endpoint: `GET /api/admin/analytics/summary`
- Protect with auth middleware and `requireRole("admin")`.
- Return `401` unauthenticated and `403` for drivers.

### Backend Tasks

- Create thin controller.
- Validate query filters with `zod`.
- Mount router in `backend/src/index.ts`.

### Frontend Tasks

- None.

### Database/Prisma Tasks

- None.

### API Routes

- `GET /api/admin/analytics/occupancy-trends`
- `GET /api/admin/analytics/peak-hours`
- `GET /api/admin/analytics/zone-utilisation`
- Optional: `GET /api/admin/analytics/summary`

### Validation Rules

- `from` and `to` must parse to valid dates if provided.
- `from` must be before `to`.
- `bucket` must be supported.
- `zoneId` must be non-empty if provided.

### Required Tests

- Admin can call analytics endpoints.
- Driver receives `403`.
- Unauthenticated caller receives `401`.
- Invalid filters return `400`.
- Responses contain no sensitive user data.
- Run backend verification loop.

### UI Requirements

- None.

### Success Criteria

- [ ] Admin analytics routes are mounted.
- [ ] Routes return occupancy trend, peak-hour, and utilisation data.
- [ ] Role restrictions are tested.
- [ ] Backend tests pass.

### Out-of-Scope Warnings

- Do not add booking analytics until Phase 04 merge.

### Phase 04 Dependency Notes

- If Phase 04 owns `GET /api/admin/bookings`, avoid importing it here.

## Step 13: Add Admin Analytics Dashboard UI With Charts

### Goal

Create the admin analytics screen for occupancy trends, peak-hour visualisation, and utilisation statistics.

### Files to Modify/Create

- `frontend/src/services/analyticsApi.ts`
- `frontend/src/features/admin/AdminAnalyticsPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/styles/global.css`
- `frontend/tests/analyticsApi.test.ts`
- `frontend/tests/adminAnalyticsUi.test.ts`
- `frontend/package.json` and `frontend/package-lock.json` only if adding a chart library is necessary.

### Required Changes/Logic

- Read `docs/design-system.md`.
- Use the Figma plugin to inspect Admin Analytics node `2015:5377` and UI States node `2015:5990`.
- Prefer a small chart implementation that fits current dependencies. If adding a chart library, choose one already approved by `docs/conventions.md`, such as Recharts or Chart.js.
- Add charts or accessible table-backed visualisations for:
  - occupancy trend
  - peak-hour visualisation
  - utilisation statistics by zone
- Include loading, empty, error, permission-denied, and retry states.
- Preserve sidebar layout.

### Backend Tasks

- None.

### Frontend Tasks

- Add typed analytics API client.
- Add `AdminAnalyticsPage`.
- Route the `Analytics` admin sidebar section to the page.
- Keep driver access blocked via UI and backend route protection.

### Database/Prisma Tasks

- None.

### API Routes

- Calls Step 12 admin analytics routes.

### Validation Rules

- Validate date filters before calling API.
- Show clear validation text for invalid date ranges.

### Required Tests

- API client test for endpoint paths and auth.
- UI renders trend chart/table from data.
- UI renders peak-hour data.
- UI renders utilisation statistics.
- UI shows permission denied for non-admin user if reachable in tests.
- UI shows loading, empty, and error states.
- Run frontend verification loop.

### UI Requirements

- Match Admin Analytics frame `2015:5377`.
- Use readable labels for every chart.
- Do not rely on colour alone.
- Provide table or text equivalents for chart values.

### Success Criteria

- [ ] Admin can open Analytics from sidebar.
- [ ] Occupancy trend visualisation renders.
- [ ] Peak-hour visualisation renders.
- [ ] Zone utilisation statistics render.
- [ ] UI states are tested.
- [ ] Frontend tests pass.
- [ ] Frontend build passes.

### Out-of-Scope Warnings

- Do not add booking analytics before Phase 04 merge.
- Do not add external BI dashboards.

### Phase 04 Dependency Notes

- Keep booking counts hidden or placeholder-only until Phase 04 merges.

## Step 14: Build Incident Reporting Service and Routes

### Goal

Allow authenticated drivers to submit incident reports for spot discrepancies and parking issues.

### Files to Modify/Create

- `backend/src/repositories/incidentReportRepository.ts`
- `backend/src/services/incidentReportService.ts`
- `backend/src/controllers/incidentReportController.ts`
- `backend/src/routes/incidentReports.ts`
- `backend/src/index.ts`
- `backend/tests/incidentReportService.test.mjs`
- `backend/tests/incidentReportRoutes.test.mjs`

### Required Changes/Logic

- Use existing `IncidentReport` Prisma model.
- Drivers submit reports with:
  - optional `spotId`
  - `issueType`
  - `description`
- Default status to `open`.
- Allow authenticated users to list their own incident reports if useful for the UI:
  - `GET /api/incident-reports/me`
- Do not expose other users' reports to drivers.

### Backend Tasks

- Add repository create/list/find methods.
- Add service validation and ownership rules.
- Add routes:
  - `POST /api/incident-reports`
  - optional `GET /api/incident-reports/me`
- Protect with auth middleware.

### Frontend Tasks

- None.

### Database/Prisma Tasks

- None. Existing fields are sufficient.

### API Routes

- `POST /api/incident-reports`
- Optional: `GET /api/incident-reports/me`

### Validation Rules

- `issueType` is required.
- Allowed MVP issue types should be explicit strings, for example:
  - `spotDiscrepancy`
  - `parkingIssue`
  - `safetyConcern`
  - `accessibilityIssue`
- `description` is required and should have a reasonable max length, such as 1000 characters.
- `spotId` is optional, but if provided it must refer to an existing parking spot.

### Required Tests

- Driver can submit incident report.
- Admin can submit incident report if allowed, or receives a documented response if not.
- Missing issue type returns `400`.
- Missing description returns `400`.
- Invalid spot id returns `404`.
- Driver can list only own reports if list route is implemented.
- Response does not expose university ID or licence plate.
- Run backend verification loop.

### UI Requirements

- None.

### Success Criteria

- [ ] Incident repository/service exists.
- [ ] Authenticated user can create incident report.
- [ ] Validation errors are controlled.
- [ ] Driver cannot read other users' reports.
- [ ] Backend tests pass.

### Out-of-Scope Warnings

- Do not implement file attachments.
- Do not implement SMS/email escalation.
- Do not implement enforcement or fines.

### Phase 04 Dependency Notes

- Do not link incidents to bookings until Phase 04 merges and a clear schema/route contract exists.

## Step 15: Add Driver Incident Report UI

### Goal

Create the driver-facing Report Issue screen.

### Files to Modify/Create

- `frontend/src/services/incidentReportsApi.ts`
- `frontend/src/features/parking/ReportIssuePage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/styles/global.css`
- `frontend/tests/incidentReportsApi.test.ts`
- `frontend/tests/reportIssueUi.test.ts`

### Required Changes/Logic

- Read `docs/design-system.md`.
- Use the Figma plugin to inspect Driver Report Issue node `2015:5234`, UI States node `2015:5990`, and Form Validation node `2015:6042`.
- Add form fields:
  - issue type
  - optional zone selector
  - optional parking spot selector filtered by zone if practical
  - description
- Use existing parking zone/spot APIs for selection.
- Show success state after submission.
- Show loading, empty, error, and validation states.

### Backend Tasks

- None.

### Frontend Tasks

- Add typed incident API client.
- Route driver sidebar `Report Issue` to `ReportIssuePage`.
- Preserve current sidebar styling.

### Database/Prisma Tasks

- None.

### API Routes

- Calls `POST /api/incident-reports`.
- Optionally calls `GET /api/incident-reports/me`.

### Validation Rules

- Issue type is required.
- Description is required.
- Description max length enforced in UI to match backend.

### Required Tests

- API client posts to correct route with auth.
- UI submits valid incident report.
- UI shows required-field errors.
- UI shows API validation errors.
- UI shows success confirmation.
- UI handles parking zone/spot loading failure.
- Run frontend verification loop.

### UI Requirements

- Match Driver Report Issue frame `2015:5234`.
- Use Form Validation frame `2015:6042`.
- Use Australian spelling.
- Do not rely on colour alone.

### Success Criteria

- [ ] Driver can open Report Issue from sidebar.
- [ ] Driver can submit a spot discrepancy or parking issue.
- [ ] Form validation states are visible and tested.
- [ ] Success state confirms report submission.
- [ ] Frontend tests pass.
- [ ] Frontend build passes.

### Out-of-Scope Warnings

- Do not upload photos/files.
- Do not connect to real maintenance systems.

### Phase 04 Dependency Notes

- Do not attach incidents to bookings in this UI until Phase 04 merges.

## Step 16: Add Admin Incident Review and Resolution Service/Routes

### Goal

Allow admins to list, review, mark in review, and resolve incident reports.

### Files to Modify/Create

- `backend/src/repositories/incidentReportRepository.ts`
- `backend/src/services/incidentReportService.ts`
- `backend/src/controllers/adminIncidentReportController.ts`
- `backend/src/routes/adminIncidentReports.ts`
- `backend/src/index.ts`
- `backend/tests/adminIncidentReportRoutes.test.mjs`
- `backend/tests/incidentReportService.test.mjs`

### Required Changes/Logic

- Admin can list all incident reports with filters:
  - `status`
  - `issueType`
  - optional `spotId`
- Admin can transition:
  - `open` -> `inReview`
  - `open` or `inReview` -> `resolved`
- Resolving requires a `resolution` message.
- Set `resolvedAt` when status becomes `resolved`.
- Return safe reporter summary only if needed; never include university ID, password hash, tokens, or full licence plate.

### Backend Tasks

- Add service methods:
  - `listIncidentReports(filters)`
  - `markIncidentInReview(id)`
  - `resolveIncident(id, resolution)`
- Add admin-only routes:
  - `GET /api/admin/incident-reports`
  - `PATCH /api/admin/incident-reports/:id/in-review`
  - `PATCH /api/admin/incident-reports/:id/resolve`

### Frontend Tasks

- None.

### Database/Prisma Tasks

- None.

### API Routes

- `GET /api/admin/incident-reports`
- `PATCH /api/admin/incident-reports/:id/in-review`
- `PATCH /api/admin/incident-reports/:id/resolve`

### Validation Rules

- Status filter must be one of `open`, `inReview`, `resolved`.
- Resolution is required to resolve an incident.
- Resolution should have a reasonable max length.

### Required Tests

- Admin can list incident reports.
- Driver receives `403` for admin incident routes.
- Unauthenticated caller receives `401`.
- Admin can mark an incident in review.
- Admin can resolve an incident with resolution text.
- Resolve without resolution returns `400`.
- Missing incident returns `404`.
- Responses do not expose sensitive user data.
- Run backend verification loop.

### UI Requirements

- None.

### Success Criteria

- [ ] Admin incident list route exists.
- [ ] Admin can mark incident in review.
- [ ] Admin can resolve incident.
- [ ] Role restrictions are tested.
- [ ] Backend tests pass.

### Out-of-Scope Warnings

- Do not implement email/SMS alerts.
- Do not implement maintenance work orders.

### Phase 04 Dependency Notes

- Do not add booking filters until Phase 04 merge.

## Step 17: Add Admin Incident Management UI

### Goal

Create the admin UI for incident review and resolution.

### Files to Modify/Create

- `frontend/src/services/adminIncidentReportsApi.ts`
- `frontend/src/features/admin/AdminIncidentManagementPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/styles/global.css`
- `frontend/tests/adminIncidentReportsApi.test.ts`
- `frontend/tests/adminIncidentManagementUi.test.ts`

### Required Changes/Logic

- Read `docs/design-system.md`.
- Use the Figma plugin to inspect Admin Incident Management node `2015:5663`, UI States node `2015:5990`, and Form Validation node `2015:6042`.
- Route admin sidebar `Incidents` to `AdminIncidentManagementPage`.
- Show incident table/list with:
  - issue type
  - spot code if attached
  - zone name if available
  - status label
  - created time
  - description preview
- Add actions:
  - mark in review
  - resolve with resolution text
- Include loading, empty, error, permission-denied, conflict, validation, and success states.

### Backend Tasks

- None.

### Frontend Tasks

- Add typed admin incident API client.
- Add page and route from `App.tsx`.
- Preserve sidebar styling.

### Database/Prisma Tasks

- None.

### API Routes

- Calls Step 16 admin incident routes.

### Validation Rules

- Resolution text is required before resolving.

### Required Tests

- API client uses admin incident routes with auth.
- Admin UI lists incidents.
- Admin UI filters by status if implemented.
- Admin UI marks incident in review.
- Admin UI resolves incident with resolution.
- Driver sees permission denied if reachable in tests.
- Loading, empty, error, and validation states are tested.
- Run frontend verification loop.

### UI Requirements

- Match Admin Incident Management frame `2015:5663`.
- Use readable status labels with colour.
- Do not expose sensitive reporter data.

### Success Criteria

- [ ] Admin can open Incidents from sidebar.
- [ ] Admin can review open reports.
- [ ] Admin can mark reports in review.
- [ ] Admin can resolve reports with resolution text.
- [ ] UI states are tested.
- [ ] Frontend tests pass.
- [ ] Frontend build passes.

### Out-of-Scope Warnings

- Do not implement maintenance work orders.
- Do not implement user disciplinary workflows.

### Phase 04 Dependency Notes

- Do not show booking-linked incident data until Phase 04 merge.

## Step 18: Add `maintenanceRequired` Spot Flagging for Spot Discrepancy Incidents

### Goal

When an incident indicates a spot discrepancy, allow the affected spot to be flagged as `maintenanceRequired` through a controlled service path.

### Files to Modify/Create

- `backend/src/services/incidentReportService.ts`
- `backend/src/repositories/incidentReportRepository.ts`
- `backend/src/repositories/parkingSpotRepository.ts` only if a small helper is needed.
- `backend/tests/incidentMaintenanceFlagging.test.mjs`
- `frontend/src/features/admin/AdminIncidentManagementPage.tsx` if exposing the flagging result in UI.
- `frontend/tests/adminIncidentManagementUi.test.ts` if UI changes.

### Required Changes/Logic

- For `issueType === "spotDiscrepancy"` and a report with `spotId`, add an admin action or automatic action to update that spot to `maintenanceRequired`.
- Recommended implementation:
  - automatic flag when admin marks the incident `inReview`, or
  - explicit admin action `flag affected spot`.
- Keep the transition in service logic, not arbitrary frontend status updates.
- Do not override `reserved` spot behavior from Phase 03 detection rules except through this incident maintenance workflow.

### Backend Tasks

- Add a service method for maintenance flagging.
- Use `ParkingSpotRepository.update()` or a focused repository method.
- Ensure the incident exists and has an affected spot.
- Return updated incident and spot summary if useful.

### Frontend Tasks

- If explicit action is chosen, add a button in admin incident management.
- Show the updated spot status with text label `Maintenance`.

### Database/Prisma Tasks

- None. `SpotStatus.maintenanceRequired` already exists.

### API Routes

- If explicit action is chosen:
  - `PATCH /api/admin/incident-reports/:id/flag-maintenance`
- If automatic action is chosen:
  - Use existing `PATCH /api/admin/incident-reports/:id/in-review`.

### Validation Rules

- Incident must exist.
- Incident must have `issueType` of `spotDiscrepancy`.
- Incident must have `spotId`.
- Already resolved incidents should not be changed unless tests document the allowed behavior.

### Required Tests

- Spot discrepancy incident flags spot as `maintenanceRequired`.
- Non-discrepancy incident does not flag spot.
- Incident without spot returns controlled validation/conflict error for explicit flag route.
- Driver cannot flag maintenance.
- UI reflects `Maintenance` status if UI changes.
- Run backend verification loop.
- Run frontend verification loop if UI changes.

### UI Requirements

- Use readable status labels with colour.
- Do not rely on colour alone.

### Success Criteria

- [ ] Spot discrepancy incident can flag affected spot as `maintenanceRequired`.
- [ ] Non-discrepancy incidents do not unexpectedly change spot status.
- [ ] Role restrictions are enforced.
- [ ] Tests pass.

### Out-of-Scope Warnings

- Do not implement real maintenance dispatch.
- Do not add hardware sensor workflows.

### Phase 04 Dependency Notes

- Do not manipulate booking reservations while flagging maintenance. If a reserved spot is flagged, add a TODO to coordinate behavior after Phase 04 merges.

## Step 19: Verify Account-Status Notification Support

### Goal

Confirm the Phase 02 account-status notification requirement remains complete and avoid duplicating it.

### Files to Modify/Create

- `backend/tests/adminUserRoutes.test.mjs` only if test coverage regressed.
- Optional documentation note in `docs/session-handoff.md` after implementation is complete.

### Required Changes/Logic

- Current code reality: `backend/src/services/adminUserService.ts` already creates `Notification` records with `type: "accountStatus"` when disabling/reactivating accounts.
- Current test reality: `backend/tests/adminUserRoutes.test.mjs` already verifies disable/reactivate create notifications.
- Do not create a second notification path unless this existing implementation has been removed.

### Backend Tasks

- Re-run existing admin user route tests.
- If missing, restore notification creation inside `AdminUserService.updateAccountStatus()`.

### Frontend Tasks

- None unless Phase 05 later adds a user notification inbox. That inbox is not required by this phase plan.

### Database/Prisma Tasks

- None.

### API Routes

- Existing:
  - `PATCH /api/admin/users/:id/disable`
  - `PATCH /api/admin/users/:id/reactivate`

### Validation Rules

- None new.

### Required Tests

- Existing test must pass:
  - disable creates `Account disabled` notification
  - reactivate creates `Account reactivated` notification
- Run backend verification loop.

### UI Requirements

- None.

### Success Criteria

- [ ] Account-status notifications are confirmed implemented.
- [ ] Existing admin user tests still pass.
- [ ] No duplicate notification mechanism is added.

### Out-of-Scope Warnings

- Do not implement booking confirmation/reminder notifications in Phase 05 if Phase 04 owns them.

### Phase 04 Dependency Notes

- Booking notification implementation remains Phase 04-owned.

## Step 20: Phase 05 End-to-End Verification

### Goal

Verify the complete Phase 05 path without depending on unfinished Phase 04 booking behavior.

### Files to Modify/Create

- `backend/tests/phase05.e2e.test.mjs`
- `frontend/tests/phase05Ui.test.ts` or focused UI tests as needed
- `docs/session-handoff.md` after Phase 05 implementation is complete

### Required Changes/Logic

- Verify recommendations, prediction, analytics, incidents, maintenance flagging, and account-status notification behavior.
- Confirm Phase 04 booking routes are not required for Phase 05 tests unless Phase 04 has merged.
- Confirm sensitive data is not exposed.

### Backend Tasks

- Add e2e test data with zones, spots, occupancy history, driver/admin users, and incident reports.
- Cover:
  - nearest available zone recommendation
  - least congested zone recommendation
  - predictive availability
  - admin analytics summary
  - driver incident submission
  - admin incident review/resolution
  - maintenanceRequired flagging
  - account-status notification verification
  - role restrictions
  - `/health`

### Frontend Tasks

- Verify key Phase 05 UI panels:
  - dashboard recommendations
  - predictive availability panel
  - admin analytics dashboard
  - driver report issue form
  - admin incident management page

### Database/Prisma Tasks

- None unless earlier steps introduced a carefully coordinated migration.

### API Routes

- Verify all Phase 05 routes added in earlier steps.

### Validation Rules

- Verify route validation errors for prediction, analytics filters, incident creation, and incident resolution.

### Required Tests

- Backend:
  - `npm run build`
  - `npm test`
- Frontend:
  - `npm run build`
  - `npm test`
- Optional manual browser check after tests pass, using the local dev server and Figma comparison for UI screens.

### UI Requirements

- Verify Figma-aligned screens:
  - Driver Dashboard node `2015:4818`
  - Driver Report Issue node `2015:5234`
  - Admin Analytics node `2015:5377`
  - Admin Incident Management node `2015:5663`
  - UI States node `2015:5990`
  - Form Validation node `2015:6042`

### Success Criteria

- [ ] Driver can see nearest available zone recommendation.
- [ ] Driver can see least congested zone recommendation.
- [ ] Driver can request predictive availability for a selected zone and future time.
- [ ] Admin can view occupancy trends.
- [ ] Admin can view peak-hour visualisation.
- [ ] Admin can view utilisation statistics by parking zone.
- [ ] Driver can report a spot discrepancy or parking issue.
- [ ] Admin can mark incident reports in review.
- [ ] Admin can resolve incident reports with resolution text.
- [ ] Spot discrepancy workflow can flag affected spot as `maintenanceRequired`.
- [ ] Account-status notification support remains complete.
- [ ] Driver cannot call admin analytics or admin incident routes.
- [ ] Unauthenticated callers receive `401` for protected Phase 05 routes.
- [ ] Phase 05 tests do not require unfinished Phase 04 booking routes.
- [ ] Backend build passes.
- [ ] Backend tests pass.
- [ ] Frontend build passes.
- [ ] Frontend tests pass.

### Out-of-Scope Warnings

- Do not implement real AI.
- Do not implement real IoT or camera feeds.
- Do not implement real payment.
- Do not implement SMS gateway or production email.
- Do not implement advanced BI beyond MVP occupancy trends, peak hours, utilisation, and incidents.

### Phase 04 Dependency Notes

- If Phase 04 has not merged, skip all booking-dependent assertions.
- If Phase 04 has merged, only add booking-aware analytics or recommendation follow-ups after reviewing Phase 04 contracts and avoiding duplicated booking logic.
