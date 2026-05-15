# Design System & UI Source of Truth

This document is the source of truth for all frontend UI implementation in the Smart Parking Management System.

## Master Figma File

Master Figma File:

`https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-2997&t=A5yYNIyf64FVkexb-1`

## Critical Rule for AI Agents

Whenever a task involves frontend UI development, the AI agent must use the official Figma plugin to inspect the relevant Figma frame before implementing or modifying code.

Do not approximate UI from memory.

Do not invent spacing, colours, typography, component sizes, or layout values.

Do not rely only on the master file link when a specific screen frame is available.

Do not use a nearby frame unless the exact target frame cannot be accessed.

If the Figma plugin cannot read the frame, stop and report the issue instead of guessing.

## Required Figma Workflow

For every frontend UI task:

1. Identify the exact screen being implemented.
2. Find the matching frame link in the Screen Source Map below.
3. Use the Figma plugin to inspect that exact frame.
4. Extract:
   - frame size
   - sidebar width
   - page padding
   - spacing between sections
   - card dimensions
   - card border radius
   - card padding
   - font family
   - font sizes
   - font weights
   - text colours
   - background colours
   - border colours
   - button styles
   - input styles
   - table styles
   - status badge styles
5. Implement the React/CSS using those values.
6. Compare the implementation visually against the Figma frame.
7. Do not mark the task complete until spacing, alignment, colour, typography, and component proportions closely match the frame.

## Tech Stack Context

Frontend stack:

- React
- TypeScript
- Vite
- CSS modules, plain CSS, Tailwind CSS, or the styling method already selected by the project

Project conventions:

- Reusable UI belongs in `frontend/src/components/`.
- Feature-specific UI belongs in `frontend/src/features/`.
- Route-level composition belongs in `frontend/src/pages/` or `frontend/src/routes/`, depending on the current codebase.
- API calls belong in `frontend/src/services/`.
- Use typed API responses.
- Handle loading, empty, error, validation, success, and permission-denied states.
- Use Australian spelling in user-facing text where applicable, such as `licence plate`.
- Use the project domain language: `parkingZone`, `parkingSpot`, `booking`, `driver`, `admin`, `spotStatus`.

---

# Screen Source Map

AI agents must use the exact linked frame for the screen being implemented. Do not rely only on the master file link.

## Driver Flow

| Step | Screen | Figma Frame Link | Node ID | Implementation Notes |
| --- | --- | --- | --- | --- |
| 01 | Login | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-4803&t=YETKkSoC9o0ujqF6-4 | `2015:4803` | Driver login screen. Use this for driver sign-in layout, login card, email/password fields, sign-in button, and forgot/create-account link styling. |
| 02 | Dashboard | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-4818&t=YETKkSoC9o0ujqF6-4 | `2015:4818` | Driver dashboard. Includes driver sidebar, top search bar, stat cards, zone status progress rows, smart suggestions panel, and predictive availability panel. |
| 03 | Parking Map | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-4884&t=YETKkSoC9o0ujqF6-4 | `2015:4884` | Driver parking map. Includes spot grid, zone filter, status legend, selected spot detail panel, and Book This Spot action. |
| 04 | Create Booking | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5117&t=YETKkSoC9o0ujqF6-4 | `2015:5117` | Driver booking creation screen. Use for selected spot summary, date/time controls, review layout, and booking confirmation action. |
| 05 | My Bookings | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5166&t=YETKkSoC9o0ujqF6-4 | `2015:5166` | Driver bookings screen. Use for current/past booking cards or table, booking status display, and cancellation action styling. |
| 06 | Report Issue | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5234&t=YETKkSoC9o0ujqF6-4 | `2015:5234` | Driver issue report screen. Use for incident form layout, zone/spot inputs, issue type, description area, and submit button styling. |

## Admin Flow

| Step | Screen | Figma Frame Link | Node ID | Implementation Notes |
| --- | --- | --- | --- | --- |
| 01 | Login | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5292&t=YETKkSoC9o0ujqF6-4 | `2015:5292` | Admin login screen. Use this for admin sign-in layout, login card, admin-specific text, email/password fields, and sign-in button styling. |
| 02 | Dashboard Overview | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5307&t=YETKkSoC9o0ujqF6-4 | `2015:5307` | Admin dashboard overview. Includes admin sidebar, top search bar, admin profile area, stat cards, recent activity table, and live detection feed panel. |
| 03 | Analytics | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5377&t=YETKkSoC9o0ujqF6-4 | `2015:5377` | Admin analytics screen. Use for occupancy trends, peak-hour visualisation, utilisation statistics, chart containers, and analytics filters. |
| 04 | User Management | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5432&t=YETKkSoC9o0ujqF6-4 | `2015:5432` | Admin user management screen. Use for user tables, account status display, disable/reactivate actions, and user detail layout. |
| 05 | Zone Management | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5511&t=YETKkSoC9o0ujqF6-4 | `2015:5511` | Admin zone management screen. Use for Phase 3 parking zone CRUD UI, zone cards/tables, add/edit forms, and delete/management actions. |
| 06 | Spot Management | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5587&t=YETKkSoC9o0ujqF6-4 | `2015:5587` | Admin spot management screen. Use for Phase 3 parking spot CRUD UI, spot status controls, status labels, filters, and admin update actions. |
| 07 | Incident Management | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5663&t=YETKkSoC9o0ujqF6-4 | `2015:5663` | Admin incident management screen. Use later for incident review and resolution workflows. Do not implement in Phase 3 unless explicitly scoped. |

## Driver Account + Permit Flow

| Step | Screen | Figma Frame Link | Node ID | Implementation Notes |
| --- | --- | --- | --- | --- |
| 01 | Create Account | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5744&t=YETKkSoC9o0ujqF6-4 | `2015:5744` | Driver registration screen. Use this for account creation layout, required registration fields, primary submit button, and navigation back to login. |
| 02 | Forgot Password | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5767&t=YETKkSoC9o0ujqF6-4 | `2015:5767` | Forgot password request screen. Use this for email input, recovery instructions, submit action, and return-to-login link styling. |
| 03 | Reset Password | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5779&t=YETKkSoC9o0ujqF6-4 | `2015:5779` | Reset password screen. Use this for new password, confirm password, validation messages, and reset confirmation action. |
| 04 | Subscription + Permit Details | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5796&t=YETKkSoC9o0ujqF6-4 | `2015:5796` | Driver permit screen. Use this for current permit card, active permit status, valid-until details, linked vehicle, eligible zones, permit options, and renew/change-plan buttons. |

## UI States and Validation

| State Area | Figma Frame Link | Node ID | Implementation Notes |
| --- | --- | --- | --- |
| Loading, Empty, Error, Conflict, Permission | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-5990&t=YETKkSoC9o0ujqF6-4 | `2015:5990` | Use this frame for reusable loading states, empty states, API error states, booking conflict states, and permission-denied states. |
| Form Validation | https://www.figma.com/design/FVGqaI2s3CA30njK7B98wV/CSIT334--Copy-?node-id=2015-6042&t=YETKkSoC9o0ujqF6-4 | `2015:6042` | Use this frame for required fields, invalid input styling, validation text, red border/error treatment, and disabled/error form behaviour. |

---

# Global Layout Rules

## App Shell

- Use a fixed left sidebar on authenticated desktop screens.
- Sidebar must match the Figma frame width, spacing, and navigation item styling.
- Main content starts immediately after the sidebar.
- Top search/header area must align with the Figma frame.
- User/profile summary in the top-right must match the Figma position and typography.
- Do not use a generic app shell if the target screen has a specific shell in Figma.

## Page Background

- Use the Figma page background colour.
- Do not use pure white for the main app background unless the frame does.
- Cards should sit on the page background with subtle borders or shadows only if shown in Figma.

## Cards

- Cards must use the Figma border colour, radius, shadow if present, and padding.
- Do not create oversized cards unless shown in Figma.
- Card content must align to the Figma spacing system.
- Stat cards should keep the same proportions across dashboard pages.

## Forms

- Inputs must match Figma height, border, radius, padding, and text styles.
- Labels must match Figma text transform, size, weight, and colour.
- Validation/error text must be clear and use the Figma error style.
- Buttons must match Figma colour, radius, height, font size, and weight.

## Typography

Use the exact typography from Figma. If Figma plugin access fails, stop and ask for frame access instead of guessing.

General fallback only when necessary:

- Font family: Inter or the font used in the Figma frame
- Page title: large, bold, dark navy
- Section heading: medium/large, semibold or bold
- Body text: regular weight, muted slate/navy
- Label text: small, uppercase, semibold
- Button text: semibold

Do not randomly change font sizes between screens.

---

# Driver Flow Layout Rules

## Driver App Frame

- Desktop driver screens use an `1180px × 720px` Figma frame, except the standalone driver login frame, which uses `900px × 620px`.
- Main authenticated driver screens use a fixed left sidebar and a light page background.
- The driver sidebar width is `180px`.
- Main content begins around `x = 220px` to `250px` depending on the element.
- Top search bar appears near `x = 220px`, `y = 28px`, with size around `320px × 36px`.
- User/profile controls appear on the top-right.

## Driver Sidebar

- Sidebar component name in Figma: `Navigation / Driver Sidebar`.
- Sidebar width: `180px`.
- Logo `UniPark` appears at approximately `x = 16px`, `y = 32px`.
- Navigation items are approximately `144px × 36px`.
- Navigation item horizontal offset: `x = 16px`.
- Navigation item text offset: `x = 14px`, `y = 9px`.

Driver navigation order:

1. Dashboard
2. Parking Map
3. My Bookings
4. My Vehicles
5. Report Issue
6. Subscription / Permit
7. Settings
8. Logout

Settings and Logout sit near the bottom of the sidebar.

Active and inactive states must match the Figma frame exactly.

## Driver Login Screen

Source frame: `Driver Flow / 01 Login`, node `2015:4803`.

- Frame size: `900px × 620px`.
- Left side contains the hero heading and description.
- Login card is positioned on the right.
- Login card size is approximately `300px × 420px`.
- Login card includes:
  - `Sign In` heading
  - `UNIVERSITY PARKING AUTHORITY` subtitle
  - email input
  - password input
  - sign-in button
  - forgot password / create account text link
- Input fields are approximately `244px × 66px`.
- Sign-in button is approximately `244px × 42px`.

## Driver Dashboard Screen

Source frame: `Driver Flow / 02 Dashboard`, node `2015:4818`.

- Frame size: `1180px × 720px`.
- Page title: `Welcome to UniPark`.
- Subtitle: `Smart Parking Management System — find, save, reserve, and pay for parking with ease`.
- Stat cards appear in a horizontal row.
- Stat card size is approximately `160px × 90px`.
- Dashboard stat cards:
  - Total Capacity
  - Available Spots
  - Occupied
  - Active Bookings
- Zone Status section uses progress rows.
- Smart Suggestions panel appears on the right.
- Predictive Availability panel appears near the bottom.
- Keep all status/progress information readable and do not rely on colour alone.

## Parking Map Screen

Source frame: `Driver Flow / 03 Parking Map`, node `2015:4884`.

- Frame size: `1180px × 720px`.
- Page title: `Parking Map`.
- Subtitle: `Interactive campus parking visualisation`.
- Parking spot grid begins around `x = 250px`, `y = 190px`.
- Parking spot grid size is approximately `560px × 252px`.
- Individual parking spot markers are approximately `17px × 17px`.
- Spot spacing is approximately `28px` horizontally and vertically.
- Status legend includes:
  - Available
  - Occupied
  - Reserved
  - Maintenance
- Selected Spot Detail Panel appears on the right.
- Selected Spot Detail Panel size is approximately `240px × 269px`.
- Selected spot panel includes:
  - selected spot heading
  - zone and spot identifier
  - status badge
  - nearest entrance
  - estimated walk time
  - sensor status
  - Book This Spot button

## Driver Flow Accessibility Rules

- Parking spot status must always include both colour and text.
- Status badges must include readable text labels.
- Interactive spot markers need accessible labels such as `Spot D-12, Available`.
- Buttons must use clear action text.
- Form fields must have visible labels.
- Error messages must explain what the user should fix.
- Driver screens must remain usable on mobile even if the Figma frame is desktop-first.

---

# Admin Flow Layout Rules

## Admin App Frame

- Desktop admin screens use an `1180px × 720px` Figma frame.
- Admin screens use a fixed left sidebar and light page background.
- The admin sidebar width is `180px`.
- Main content begins around `x = 220px` to `250px`.
- Top search bar appears near `x = 220px`, `y = 28px`, with size around `320px × 36px`.
- Notification, language, and admin profile controls appear on the top-right.
- Admin pages should preserve the same overall shell as `Admin Flow / 02 Dashboard Overview`.

## Admin Sidebar

- Sidebar component name in Figma: `Navigation / Admin Sidebar`.
- Sidebar width: `180px`.
- Logo `UniPark` appears at approximately `x = 16px`, `y = 32px`.
- Navigation items are approximately `144px × 36px`.
- Navigation item horizontal offset: `x = 16px`.
- Navigation item text offset: `x = 14px`, `y = 9px`.

Admin navigation order:

1. Dashboard
2. Users
3. Zones
4. Spots
5. Bookings
6. Incidents
7. Analytics
8. Settings
9. Logout

Settings and Logout sit near the bottom of the sidebar.

Active and inactive states must match the Figma frame exactly.

## Admin Dashboard Overview

Source frame: `Admin Flow / 02 Dashboard Overview`, node `2015:5307`.

- Frame size: `1180px × 720px`.
- Page title: `Admin Dashboard`.
- Subtitle: `Real-time oversight of campus parking operations`.
- Dashboard stat cards appear in a horizontal row.
- Stat card size is approximately `160px × 90px`.
- Dashboard stat cards:
  - Occupancy
  - Bookings
  - Incidents
  - System Health
- Recent Activity table appears below the stat cards.
- Recent Activity table size is approximately `760px × 310px`.
- Table columns:
  - Time
  - Event
  - Zone
  - Status
- Live Detection Feed panel appears near the bottom-right.
- Live Detection Feed panel size is approximately `260px × 120px`.
- Live Detection Feed entries should show status transitions in readable text, for example:
  - `A-15: Available → Occupied`
  - `B-04: Occupied → Available`
  - `D-12: Reserved → Maintenance`

## Admin Zone Management

Source frame: `Admin Flow / 05 Zone Management`, node `2015:5511`.

This is the source of truth for Phase 3 zone management UI.

Use this screen when implementing:

- list parking zones
- create parking zone
- edit parking zone
- remove parking zone
- display zone capacity
- display available spots
- display occupancy rate

Do not invent a different zone layout if this frame is available.

## Admin Spot Management

Source frame: `Admin Flow / 06 Spot Management`, node `2015:5587`.

This is the source of truth for Phase 3 spot management UI.

Use this screen when implementing:

- list parking spots
- create parking spot
- edit parking spot
- remove parking spot
- update spot status
- filter spots by zone or status

Spot status controls must use both colour and readable text.

Do not update spot status from arbitrary UI actions unless the backend route supports the transition.

## Admin Analytics and Incident Screens

- `Admin Flow / 03 Analytics` belongs mainly to Phase 5.
- `Admin Flow / 07 Incident Management` belongs mainly to Phase 5.
- They can be used as visual references for shell consistency earlier, but do not implement their full functionality during Phase 3 unless the phase plan explicitly says so.

## Admin Accessibility Rules

- Admin tables must have readable column headings.
- Status indicators must include text labels, not colour alone.
- Destructive actions such as delete, disable, or remove must show confirmation where appropriate.
- Empty states must explain what is missing and what the admin can do next.
- Error states must explain whether the issue came from validation, permission, or data loading.

---

# Driver Account + Permit Layout Rules

## Account Creation, Forgot Password, and Reset Password

- These screens belong to the authentication/account entry flow.
- Use the exact Figma frames above rather than reusing a generic form layout.
- Form fields must have visible labels.
- Primary actions must match the Figma button size, colour, radius, and typography.
- Error states must use the UI State / Validation frames.
- Do not expose raw password values in UI, logs, or debug output.
- Password validation must be visible and understandable.

## Subscription + Parking Permit Screen

Source frame: `Account Flow / Subscription + Permit Detail`, node `2015:5796`.

- Frame size: `1180px × 720px`.
- Uses the standard Driver Sidebar.
- Sidebar width: `180px`.
- Page title: `Subscription + Parking Permit`.
- Subtitle: `Manage simulated permits and membership status`.
- Main content starts around `x = 250px`.
- The page contains two main cards:
  - `Current Permit Card`
  - `Permit Options`

## Current Permit Card

- Approximate size: `390px × 300px`.
- Position: around `x = 250px`, `y = 190px`.
- Must show:
  - current permit title
  - permit type, for example `Student Monthly Permit`
  - status badge, for example `Active`
  - valid-until date
  - linked vehicle
  - eligible zones
  - `Renew Permit` button
- Status badge must include both colour and readable text.

## Permit Options Card

- Approximate size: `390px × 300px`.
- Position: around `x = 690px`, `y = 190px`.
- Must show:
  - Daily Pass
  - Weekly Pass
  - Monthly Pass
  - simulated permit prices if used by the current UI
  - `Change Plan` button
- This screen must not look like a real payment checkout.
- Any payment/price wording must clearly stay within the simulated permit flow for the university project MVP.

## Permit Accessibility Rules

- Permit status must not rely on colour alone.
- Renewal/change-plan buttons must have clear action text.
- If no active permit exists, show an empty state explaining that the driver can select a permit option.
- If loading permit details fails, show an error state with a retry action.

---

# UI State Rules

These UI states are reusable across Driver and Admin screens. Do not create new state designs unless the Figma file is updated.

## Loading State

Source frame: `UI States / Loading Empty Error Conflict Permission`, node `2015:5990`.

- Loading cards use the reusable `State / Loading` component.
- Loading message example: `Loading parking data...`
- Use loading states for:
  - dashboard data
  - parking map data
  - bookings
  - vehicles
  - subscriptions
  - admin users
  - zones
  - spots
  - incidents
  - analytics
- Do not leave pages blank while data is loading.

## Empty State

Source frame: `State / Empty`.

- Empty state example heading: `No bookings yet`.
- Empty state example description: `Create your first booking from the parking map.`
- Use empty states when a valid API request succeeds but returns no records.
- Empty state copy must explain what is missing and what the user can do next.

## Error State

Source frame: `State / Error`.

- Error state example heading: `Unable to load data`.
- Error state example description: `Please check your connection and try again.`
- Error states should include a retry button when retrying is possible.
- Retry button must follow the Figma `Button / Retry` styling.
- Do not show raw backend stack traces or technical errors to normal users.

## Booking Conflict State

Source frame: `State / Booking Conflict`.

- Booking conflict heading: `Booking conflict`.
- Example copy: `Spot D-12 has already been reserved for this time window. Please choose another spot or time.`
- Primary action: `Choose Another Spot`.
- Use this only for booking overlap or unavailable spot conflicts.
- This belongs mainly to Phase 4, but the style must be ready earlier if reusable components are created.

## Permission Denied State

Source frame: `State / Permission Denied`.

- Permission denied heading: `Permission denied`.
- Example copy: `This page is only available to administrator accounts.`
- Primary action: `Return to Dashboard`.
- Use this when:
  - a driver attempts to access an admin-only page
  - an unauthorised user reaches a protected route
  - an authenticated user lacks the required role
- Do not silently redirect without showing useful feedback unless the route is part of login/session restoration.

---

# Form Validation Rules

Source frame: `UI States / Form Validation`, node `2015:6042`.

## Validation Layout

- Frame size: `900px × 620px`.
- Example form: `Booking Form With Errors`.
- Example form card size: approximately `500px × 350px`.
- Inputs may expand in height when validation text is visible.
- Error text appears below the input value area.
- Invalid fields use a visible error border.
- Error text must be short, direct, and actionable.

## Required Field Errors

Use this pattern for required fields:

- `Date is required`
- `Licence plate is required`
- `Email is required`
- `Password is required`
- `Name is required`
- `University ID is required`
- `Parking zone is required`
- `Parking spot is required`

## Invalid Value Errors

Use this pattern for invalid values:

- `Enter a valid email address`
- `Password must be at least 8 characters`
- `End time must be after start time`
- `Start time must be in the future`
- `Licence plate is already registered`
- `This parking spot is not available`
- `This action is only available to admins`

## Validation Notes from Figma

- Required fields are marked.
- Invalid fields use red border.
- Error text appears below input.
- Buttons remain clear and readable.
- Do not disable the whole form without explaining why.
- Do not rely on colour alone to indicate an error.

---

# Status Colours and Accessibility

Parking, booking, account, and incident statuses must never rely on colour alone.

Every status indicator must include:

- colour
- text label
- accessible contrast
- accessible label where interactive

Required parking spot statuses:

- `available`
- `occupied`
- `reserved`
- `maintenanceRequired`

Required booking statuses:

- `pending`
- `confirmed`
- `cancelled`
- `expired`
- `completed`

Required account statuses:

- `active`
- `disabled`
- `pending`

Recommended UI labels:

| Domain Value | User-Facing Label |
| --- | --- |
| `available` | Available |
| `occupied` | Occupied |
| `reserved` | Reserved |
| `maintenanceRequired` | Maintenance |
| `pending` | Pending |
| `confirmed` | Confirmed |
| `cancelled` | Cancelled |
| `expired` | Expired |
| `completed` | Completed |
| `active` | Active |
| `disabled` | Disabled |

---

# Phase Boundaries for UI Implementation

## Phase 3 UI Scope

Phase 3 may implement:

- Driver dashboard shell/data display
- Parking map
- Admin dashboard overview
- Zone management
- Spot management
- Loading, empty, error, and permission states for these screens
- Real-time visual updates for parking status

## Do Not Implement in Phase 3 Unless Explicitly Scoped

- Booking creation logic
- Booking conflict backend logic
- My Bookings backend workflow
- Recommendations
- Predictive analytics
- Incident submission and resolution
- Payment or real checkout flow
- Advanced admin analytics

Some screens are included in this design system for future consistency, but their full functionality belongs to later phases.

---

# Figma-to-Code Accuracy Checklist

Before marking any frontend UI task as complete:

- [ ] The exact Figma frame was opened with the Figma plugin.
- [ ] The implementation uses the correct frame-specific layout.
- [ ] The implemented screen uses the correct sidebar width.
- [ ] The implemented screen uses the correct page background colour.
- [ ] The implemented screen uses the correct card border radius.
- [ ] The implemented screen uses the correct card padding.
- [ ] The implemented screen uses the correct input height and border radius.
- [ ] The implemented screen uses the correct button height and colour.
- [ ] Typography matches the frame closely.
- [ ] Spacing between sections matches the frame closely.
- [ ] Active and inactive navigation items match the frame.
- [ ] Loading state exists where data is fetched.
- [ ] Error state exists where API calls can fail.
- [ ] Empty state exists where no data may be returned.
- [ ] Permission-denied state exists where role access can fail.
- [ ] Form validation states match the validation frame.
- [ ] Status indicators use text and colour together.
- [ ] The screen builds successfully.
- [ ] The result was visually compared against the Figma frame.

---

# Global State Implementation Checklist

Before completing any frontend screen, check:

- [ ] Loading state exists for every data-fetching view.
- [ ] Empty state exists for valid empty API responses.
- [ ] Error state exists for failed API requests.
- [ ] Permission-denied state exists for role-protected routes.
- [ ] Form validation errors appear below the relevant field.
- [ ] Error states do not expose sensitive backend details.
- [ ] Status and error indicators use text, not colour alone.
- [ ] Retry or recovery action is provided where appropriate.
- [ ] Styling matches the relevant Figma UI state frame.

---

# If Figma Access Fails

If the Figma plugin cannot access the file or frame:

1. Do not guess the design.
2. Report the exact plugin error.
3. Ask for one of:
   - the exact frame link
   - permission to the Figma file
   - exported design tokens
   - manual measurements
   - screenshot plus measurements

Known plugin issue:

- Some Figma plugin calls may fail with `You currently have nothing selected`.
- If this happens, the agent should use the exact frame link and node ID from this document, or ask the user to open/select the target frame in Figma.
- The agent must not silently fall back to approximate styling.

---

# Known Issue This File Prevents

The implementation may drift from the Figma design if Codex only reads the master file link without a specific frame.

To avoid this, every future UI task should include or resolve to the exact target frame link from the Screen Source Map.