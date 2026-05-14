# Phase 02: Authentication, Accounts, and Role Access

Use this phase to add secure identity and access control so later parking, booking, recommendation, analytics, and admin features can trust the current user. Follow the steps in order; do not build parking inventory management, booking workflows, dashboards, maps, recommendations, or analytics in this phase.

Current Phase 01 reality:

- Backend is Node.js, TypeScript, Express, Prisma, and PostgreSQL.
- `GET /health` exists and is the only HTTP route.
- Prisma already models users, vehicle profiles, subscriptions, bookings, notifications, incident reports, parking zones, parking spots, detection events, and occupancy history.
- Seed data exists for demo users and related entities.
- Frontend folders exist, but no React/Vite app has been created yet.
- UI work must follow `docs/design-system.md`, including reading the master Figma file before implementing frontend screens.

## Step 1: Add Authentication Dependencies and Environment Settings

### Files to Modify/Create

- `backend/package.json`
- `backend/package-lock.json`
- `backend/.env.example`
- `backend/src/config/env.ts`

### Required Changes/Logic

- Add backend dependencies for password hashing, token/session signing, and validation.
- Use a conservative stack such as `bcryptjs`, `jsonwebtoken`, and `zod`, unless the team deliberately chooses alternatives.
- Extend environment parsing for authentication secrets and token expiry settings.
- Keep secrets as placeholders in `.env.example`; do not commit real secrets.
- Do not create auth routes or business logic yet.

### Success Criteria

- [ ] `backend/package.json` includes dependencies for password hashing, token/session signing, and request validation.
- [ ] `backend/.env.example` includes `AUTH_TOKEN_SECRET`.
- [ ] `backend/.env.example` includes an access-token expiry value such as `AUTH_TOKEN_EXPIRES_IN`.
- [ ] `backend/src/config/env.ts` exposes auth settings through typed config.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` still passes.
- [ ] No `/auth/*`, `/api/auth/*`, registration, login, logout, or profile route exists yet.

## Step 2: Create Password Hashing Utilities

### Files to Modify/Create

- `backend/src/services/passwordService.ts`
- `backend/tests/passwordService.test.mjs`

### Required Changes/Logic

- Create a password service for hashing and verifying passwords.
- Store only password hashes; never return or log raw passwords.
- Enforce a minimum password length for Phase 2, such as 8 characters.
- Keep the service independent from Express and Prisma so it can be tested directly.

### Success Criteria

- [ ] Hashing the same password twice produces different hash strings.
- [ ] `verifyPassword` returns `true` for the correct password.
- [ ] `verifyPassword` returns `false` for an incorrect password.
- [ ] Password hashes do not equal the raw password.
- [ ] A too-short password fails validation.
- [ ] `npm test` passes without starting an API server.

## Step 3: Create Token Utilities and Auth Types

### Files to Modify/Create

- `backend/src/services/tokenService.ts`
- `backend/src/domain/auth.ts`
- `backend/tests/tokenService.test.mjs`

### Required Changes/Logic

- Define an authenticated user payload containing `userId`, `role`, and `accountStatus`.
- Create a token service that signs and verifies authentication tokens.
- Reject invalid, malformed, or expired tokens.
- Keep token logic independent from Express middleware.

### Success Criteria

- [ ] A valid token can be signed and verified.
- [ ] The verified payload includes `userId`, `role`, and `accountStatus`.
- [ ] A token signed with the wrong secret is rejected.
- [ ] A malformed token is rejected.
- [ ] Token tests pass without a running API server.
- [ ] `npm run typecheck` passes.

## Step 4: Add User Repository Methods

### Files to Modify/Create

- `backend/src/repositories/userRepository.ts`
- `backend/tests/userRepository.test.mjs`

### Required Changes/Logic

- Add repository methods for finding users by ID, email, and university ID.
- Add a method for creating a driver with an initial vehicle profile.
- Add a method for updating account status.
- Ensure repository return shapes never expose `passwordHash` unless the caller explicitly asks for authentication verification.
- Keep HTTP request/response handling out of the repository.

### Success Criteria

- [ ] A test can create a driver user with one related vehicle profile.
- [ ] A test can find a user by email.
- [ ] A test can find a user by university ID.
- [ ] A test can find a user by ID.
- [ ] A test can update a user's account status to `disabled`.
- [ ] Public repository methods used for profile reads do not return `passwordHash`.
- [ ] `npm test` passes against a migrated test database.

## Step 5: Implement Registration Service

### Files to Modify/Create

- `backend/src/services/registrationService.ts`
- `backend/tests/registrationService.test.mjs`

### Required Changes/Logic

- Register a driver using name, university ID, email, password, and licence plate.
- Validate required fields and email format.
- Normalize email to lowercase before saving.
- Hash the password before storing it in `passwordHash`.
- Create the first vehicle profile during registration.
- Prevent duplicate email, university ID, and licence plate records.
- Default new driver accounts to `active` unless the team intentionally keeps `pending`.

### Success Criteria

- [ ] A valid registration creates one `driver` user.
- [ ] A valid registration creates one related vehicle profile.
- [ ] The stored password is hashed and is not the raw password.
- [ ] Duplicate email registration fails.
- [ ] Duplicate university ID registration fails.
- [ ] Duplicate licence plate registration fails.
- [ ] Missing required fields return validation errors.
- [ ] `npm test` passes against a migrated test database.

## Step 6: Implement Login and Logout Service Logic

### Files to Modify/Create

- `backend/src/services/authService.ts`
- `backend/tests/authService.test.mjs`

### Required Changes/Logic

- Authenticate users by email and password.
- Return a signed token and safe user summary for valid credentials.
- Reject invalid email/password combinations with a generic error.
- Block login for `disabled` accounts.
- Treat logout as a client-side token discard for the MVP unless a token denylist is deliberately introduced.
- Do not implement HTTP routes yet.

### Success Criteria

- [ ] Login succeeds with a registered active user's correct email and password.
- [ ] Login response includes a token.
- [ ] Login response includes a safe user summary without `passwordHash`.
- [ ] Login fails with the wrong password.
- [ ] Login fails for a disabled account.
- [ ] Logout behavior is documented as token discard or implemented with a tested denylist.
- [ ] `npm test` passes against a migrated test database.

## Step 7: Add Authentication Middleware and Role Guards

### Files to Modify/Create

- `backend/src/middleware/authMiddleware.ts`
- `backend/src/middleware/requireRole.ts`
- `backend/src/types/express.d.ts`
- `backend/tests/authMiddleware.test.mjs`
- `backend/tests/requireRole.test.mjs`

### Required Changes/Logic

- Add middleware that reads a bearer token and attaches the authenticated user payload to the request.
- Return `401` when the token is missing or invalid.
- Return `403` when a valid user lacks the required role.
- Support `driver` and `admin` roles from `docs/domain.md`.
- Do not add feature routes yet.

### Success Criteria

- [ ] A request with a valid bearer token receives `request.user`.
- [ ] A request with no token returns `401`.
- [ ] A request with an invalid token returns `401`.
- [ ] A driver blocked from an admin-only handler receives `403`.
- [ ] An admin allowed through an admin-only handler reaches the handler.
- [ ] Middleware tests pass without requiring parking or booking routes.

## Step 8: Add Auth and Current-User API Routes

### Files to Modify/Create

- `backend/src/routes/auth.ts`
- `backend/src/controllers/authController.ts`
- `backend/src/routes/users.ts`
- `backend/src/controllers/userController.ts`
- `backend/src/index.ts`
- `backend/tests/authRoutes.test.mjs`
- `backend/tests/currentUserRoutes.test.mjs`

### Required Changes/Logic

- Add route group for registration, login, logout, and current user profile.
- Use REST-style routes, such as `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/users/me`.
- Keep controllers thin: parse request, call services, return responses.
- Protect `GET /api/users/me` with auth middleware.
- Return safe user data only: no `passwordHash`, no raw token secret, and no unnecessary sensitive fields.

### Success Criteria

- [ ] `POST /api/auth/register` creates a driver and returns safe user data.
- [ ] `POST /api/auth/login` returns a token for valid credentials.
- [ ] `POST /api/auth/login` rejects invalid credentials.
- [ ] `POST /api/auth/logout` returns a successful response without requiring database mutation.
- [ ] `GET /api/users/me` returns the authenticated user's safe profile.
- [ ] `GET /api/users/me` returns `401` without a valid token.
- [ ] `GET /health` still works.
- [ ] `npm test` passes against a migrated test database.

## Step 9: Add Vehicle Profile Account Endpoints

### Files to Modify/Create

- `backend/src/repositories/vehicleProfileRepository.ts`
- `backend/src/services/vehicleProfileService.ts`
- `backend/src/controllers/vehicleProfileController.ts`
- `backend/src/routes/vehicleProfiles.ts`
- `backend/src/index.ts`
- `backend/tests/vehicleProfileRoutes.test.mjs`

### Required Changes/Logic

- Let authenticated users view their own vehicle profiles.
- Let authenticated users add a vehicle profile.
- Let authenticated users update their own vehicle profile details.
- Prevent users from reading or editing another user's vehicle profiles.
- Keep licence plate uniqueness enforced.

### Success Criteria

- [ ] `GET /api/vehicle-profiles/me` returns only the authenticated user's vehicles.
- [ ] `POST /api/vehicle-profiles` creates a vehicle for the authenticated user.
- [ ] Updating a vehicle owned by the user succeeds.
- [ ] Updating another user's vehicle returns `403` or `404`.
- [ ] Creating a duplicate licence plate fails.
- [ ] Responses do not expose unrelated user data.
- [ ] `npm test` passes against a migrated test database.

## Step 10: Add Simulated Subscription Purchase and Renewal

### Files to Modify/Create

- `backend/src/repositories/subscriptionRepository.ts`
- `backend/src/services/subscriptionService.ts`
- `backend/src/controllers/subscriptionController.ts`
- `backend/src/routes/subscriptions.ts`
- `backend/src/index.ts`
- `backend/tests/subscriptionRoutes.test.mjs`

### Required Changes/Logic

- Let authenticated users purchase or renew simulated daily, weekly, or monthly parking subscriptions.
- Calculate subscription `startTime` and `endTime` from the selected type.
- Mark new simulated subscriptions as `active`.
- Return a safe subscription summary.
- Do not implement real payment processing; it is out of scope.

### Success Criteria

- [ ] `POST /api/subscriptions` creates an active daily subscription.
- [ ] `POST /api/subscriptions` creates an active weekly subscription.
- [ ] `POST /api/subscriptions` creates an active monthly subscription.
- [ ] Invalid subscription type returns a validation error.
- [ ] Unauthenticated requests return `401`.
- [ ] Response confirms the simulated nature of the purchase or avoids payment language implying real money was charged.
- [ ] `npm test` passes against a migrated test database.

## Step 11: Add Password Change and Reset Flow

### Files to Modify/Create

- `backend/src/services/passwordResetService.ts`
- `backend/src/controllers/passwordController.ts`
- `backend/src/routes/password.ts`
- `backend/src/index.ts`
- `backend/tests/passwordRoutes.test.mjs`
- Optional Prisma schema/migration files only if the team chooses to persist reset tokens.

### Required Changes/Logic

- Let authenticated users change their password by providing their current password and a new password.
- Let users request a simulated password reset by email.
- For the MVP, reset links/codes may be simulated through a safe response or notification record.
- Never return whether an email exists in a way that enables account enumeration.
- Hash all new passwords before saving.

### Success Criteria

- [ ] Authenticated password change succeeds with the correct current password.
- [ ] Authenticated password change fails with an incorrect current password.
- [ ] New password is stored as a hash, not raw text.
- [ ] Password reset request returns a generic success response for existing and unknown emails.
- [ ] Simulated reset does not send real email unless explicitly configured later.
- [ ] Login succeeds with the changed password.
- [ ] Login fails with the old password after change.
- [ ] `npm test` passes against a migrated test database.

## Step 12: Add Admin Account Disable and Reactivate APIs

### Files to Modify/Create

- `backend/src/services/adminUserService.ts`
- `backend/src/controllers/adminUserController.ts`
- `backend/src/routes/adminUsers.ts`
- `backend/src/index.ts`
- `backend/tests/adminUserRoutes.test.mjs`

### Required Changes/Logic

- Let admins list user account summaries.
- Let admins disable a user account.
- Let admins reactivate a disabled user account.
- Protect all admin account routes with `requireRole("admin")`.
- Create account-status notifications when an account is disabled or reactivated.
- Do not build parking, booking, incident, or analytics admin features in this phase.

### Success Criteria

- [ ] Admin can list user account summaries.
- [ ] Driver cannot list user account summaries and receives `403`.
- [ ] Admin can disable an active user.
- [ ] Disabled user cannot log in.
- [ ] Admin can reactivate a disabled user.
- [ ] Reactivated user can log in again.
- [ ] Disable/reactivate creates an account-status notification record.
- [ ] Responses do not expose `passwordHash`.
- [ ] `npm test` passes against a migrated test database.

## Step 13: Add Sensitive-Data Response Checks

### Files to Modify/Create

- `backend/src/utils/safeUser.ts`
- `backend/tests/sensitiveData.test.mjs`
- Existing auth/account route tests as needed

### Required Changes/Logic

- Centralize safe user serialization.
- Ensure API responses never include `passwordHash`.
- Avoid exposing full licence plates except on the authenticated user's own profile or admin-approved account views.
- Avoid logging passwords, tokens, university IDs, or full licence plates.

### Success Criteria

- [ ] Registration response does not include `passwordHash`.
- [ ] Login response does not include `passwordHash`.
- [ ] `GET /api/users/me` does not include `passwordHash`.
- [ ] Admin user-list response does not include `passwordHash`.
- [ ] Tests fail if `passwordHash` appears anywhere in serialized auth/account API responses.
- [ ] `npm test` passes.

## Step 14: Scaffold the Frontend App

### Files to Modify/Create

- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/tsconfig.json`
- `frontend/index.html`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/styles/`
- `frontend/src/types/`
- `frontend/tests/`

### Required Changes/Logic

- Create a React + TypeScript + Vite frontend.
- Before implementing styling, follow `docs/design-system.md`: read the master Figma file with the official Figma plugin and extract colours, typography, spacing, and layout.
- Add a lightweight test/build setup appropriate for the frontend.
- Render only a minimal app shell at first.
- Do not build parking, booking, dashboard, map, recommendation, analytics, or admin feature screens yet.

### Success Criteria

- [ ] `cd frontend && npm install` completes.
- [ ] `cd frontend && npm run build` passes.
- [ ] `cd frontend && npm test` passes if a test script is added.
- [ ] The app shell renders without runtime errors.
- [ ] Styling references documented design tokens or notes derived from `docs/design-system.md`.
- [ ] No parking dashboard, booking, map, recommendation, prediction, or analytics UI exists yet.

## Step 15: Add Frontend Auth API Client and Session State

### Files to Modify/Create

- `frontend/src/services/apiClient.ts`
- `frontend/src/services/authApi.ts`
- `frontend/src/features/auth/authTypes.ts`
- `frontend/src/features/auth/authState.tsx`
- `frontend/src/types/`
- `frontend/tests/authApi.test.ts` or equivalent

### Required Changes/Logic

- Create typed client functions for register, login, logout, and current-user profile.
- Store the auth token in a simple MVP-safe location chosen by the team.
- Attach bearer tokens to authenticated API calls.
- Handle `401` by clearing the current session.
- Follow `docs/design-system.md` for any visible loading/error state styling created in this step.

### Success Criteria

- [ ] Auth API client sends expected request bodies for register and login.
- [ ] Auth API client stores a token after successful login.
- [ ] Auth API client attaches `Authorization: Bearer <token>` to authenticated requests.
- [ ] Auth state clears token/session after logout.
- [ ] Auth state clears token/session after a `401`.
- [ ] Frontend build passes.

## Step 16: Build Registration and Login UI

### Files to Modify/Create

- `frontend/src/features/auth/RegisterPage.tsx`
- `frontend/src/features/auth/LoginPage.tsx`
- `frontend/src/components/`
- `frontend/src/routes/`
- `frontend/src/styles/`
- `frontend/tests/`

### Required Changes/Logic

- Before implementation, follow `docs/design-system.md`: use the official Figma plugin to read the master Figma file and apply its exact colours, typography, spacing, and layout.
- Build registration UI for name, university ID, email, password, and licence plate.
- Build login UI for email and password.
- Show validation errors for required fields, invalid email, and short password.
- Show loading and error states.
- On successful login, store the session and navigate to a simple authenticated account area.

### Success Criteria

- [ ] Registration form includes name, university ID, email, password, and licence plate fields.
- [ ] Login form includes email and password fields.
- [ ] Required-field errors are visible and styled according to `docs/design-system.md`.
- [ ] Invalid email errors are visible.
- [ ] Short password errors are visible.
- [ ] Successful login stores a session.
- [ ] Failed login shows a safe generic error.
- [ ] Frontend build passes.

## Step 17: Build Current Profile, Vehicle Profile, and Subscription UI

### Files to Modify/Create

- `frontend/src/features/account/ProfilePage.tsx`
- `frontend/src/features/account/VehicleProfilesPanel.tsx`
- `frontend/src/features/account/SubscriptionPanel.tsx`
- `frontend/src/services/accountApi.ts`
- `frontend/src/services/subscriptionApi.ts`
- `frontend/src/routes/`
- `frontend/tests/`

### Required Changes/Logic

- Before implementation, follow `docs/design-system.md`: use the official Figma plugin to read the master Figma file and apply its exact colours, typography, spacing, and layout.
- Show authenticated user's safe profile information.
- Show the user's vehicle profiles.
- Let the user add or update their own vehicle profile.
- Let the user select daily, weekly, or monthly simulated subscription purchase/renewal.
- Clearly avoid real payment UI because real payment gateway integration is out of scope.

### Success Criteria

- [ ] Profile page shows current user's name, email, role, and account status.
- [ ] Profile page does not show `passwordHash`.
- [ ] Vehicle panel lists only the authenticated user's vehicles.
- [ ] Add/update vehicle UI handles duplicate licence plate errors.
- [ ] Subscription panel offers daily, weekly, and monthly options.
- [ ] Subscription flow does not look like or claim to be a real payment checkout.
- [ ] Loading, empty, error, and success states follow `docs/design-system.md`.
- [ ] Frontend build passes.

## Step 18: Build Admin Account Management UI

### Files to Modify/Create

- `frontend/src/features/admin/AdminUsersPage.tsx`
- `frontend/src/services/adminUsersApi.ts`
- `frontend/src/routes/`
- `frontend/src/components/`
- `frontend/tests/`

### Required Changes/Logic

- Before implementation, follow `docs/design-system.md`: use the official Figma plugin to read the master Figma file and apply its exact colours, typography, spacing, and layout.
- Build an admin-only account management page.
- Show user account summaries without `passwordHash`.
- Let admins disable and reactivate accounts.
- Show account-status notifications or success messages after changes.
- Show permission-denied state for non-admin users.

### Success Criteria

- [ ] Admin users can see account summaries.
- [ ] Driver users see a permission-denied state.
- [ ] Disable account action asks for confirmation.
- [ ] Reactivate account action asks for confirmation or clearly shows the effect.
- [ ] Disabled account status is visually distinct and accessible.
- [ ] No `passwordHash` appears in the UI.
- [ ] Loading, empty, error, and success states follow `docs/design-system.md`.
- [ ] Frontend build passes.

## Step 19: Phase 02 End-to-End Verification

### Files to Modify/Create

- `backend/tests/phase02.e2e.test.mjs` or equivalent
- `frontend/tests/` as needed
- `docs/phases/phase-02.md` checklist updates only if the team changes scope

### Required Changes/Logic

- Verify the complete Phase 2 path against a migrated test database.
- Use seeded or test-created users.
- Cover driver registration, login, current profile, vehicle profile, subscription, password change/reset, admin disable/reactivate, and role restrictions.
- Confirm `GET /health` still works.
- Confirm no Phase 3 parking inventory CRUD or real-time monitoring features were built early.

### Success Criteria

- [ ] A new driver can register, log in, and fetch `GET /api/users/me`.
- [ ] The driver can add or update their own vehicle profile.
- [ ] The driver can create a simulated subscription.
- [ ] The driver can change password and then log in with the new password.
- [ ] Admin can disable the driver.
- [ ] Disabled driver cannot log in.
- [ ] Admin can reactivate the driver.
- [ ] Reactivated driver can log in.
- [ ] Driver cannot call admin account-management routes.
- [ ] Auth/account responses never include `passwordHash`.
- [ ] Backend tests pass.
- [ ] Frontend build passes.
- [ ] No parking zone CRUD, parking spot CRUD, simulated sensor processing, real-time dashboard, parking map, booking workflow, recommendation, prediction, incident admin workflow, or analytics feature has been implemented in Phase 2.
