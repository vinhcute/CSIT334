# UniPark Local Setup Guide

Use this guide to run the UniPark app locally on a new machine.

The app has three parts:

- PostgreSQL database
- Backend API at `http://127.0.0.1:3000`
- Frontend app at `http://127.0.0.1:5173`

Important: the backend does not use `npm run dev`. Start the backend with `npm start`.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL
- Git
- A terminal app:
  - macOS: Terminal or iTerm
  - Windows: PowerShell, Windows Terminal, or Git Bash

## Local Database Settings

The examples use:

```txt
Database: smart_parking_test
User: smart_parking_user
Password: change_me
Host: 127.0.0.1
Port: 55432
```

Database URL:

```txt
postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test
```

If PostgreSQL runs on the default port on your machine, use port `5432` instead of `55432`.

Use the same database URL in every backend and Prisma command.

## First-Time Setup

### 1. Install Dependencies

macOS / Linux / Git Bash:

```sh
cd path/to/project/backend
npm install

cd ../frontend
npm install
```

Windows PowerShell:

```powershell
cd path\to\project\backend
npm install

cd ..\frontend
npm install
```

### 2. Start PostgreSQL

macOS with Homebrew, manual start:

```sh
postgres -D /opt/homebrew/var/postgresql@14 -p 55432
```

macOS with Homebrew service:

```sh
brew services start postgresql@14
```

Windows, if PostgreSQL is installed as a service:

```powershell
net start postgresql
```

Leave the PostgreSQL terminal open if you started it with the `postgres ...` command.

### 3. Create The Database And User

Skip this step if the database and user already exist.

macOS / Linux / Git Bash:

```sh
createuser -h 127.0.0.1 -p 55432 smart_parking_user
createdb -h 127.0.0.1 -p 55432 -O smart_parking_user smart_parking_test
psql -h 127.0.0.1 -p 55432 -d smart_parking_test -c "ALTER USER smart_parking_user WITH PASSWORD 'change_me';"
```

Windows PowerShell:

```powershell
createuser -h 127.0.0.1 -p 55432 smart_parking_user
createdb -h 127.0.0.1 -p 55432 -O smart_parking_user smart_parking_test
psql -h 127.0.0.1 -p 55432 -d smart_parking_test -c "ALTER USER smart_parking_user WITH PASSWORD 'change_me';"
```

If your PostgreSQL server uses port `5432`, replace `55432` with `5432`.

### 4. Check PostgreSQL

```sh
pg_isready -h 127.0.0.1 -p 55432
```

Expected:

```txt
127.0.0.1:55432 - accepting connections
```

### 5. Apply Database Schema

For local setup, use `prisma db push`.

macOS / Linux / Git Bash:

```sh
cd path/to/project/backend
DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test' npx prisma db push --schema prisma/schema.prisma
DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test' npx prisma generate
```

Windows PowerShell:

```powershell
cd path\to\project\backend
$env:DATABASE_URL = 'postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test'
npx prisma db push --schema prisma/schema.prisma
npx prisma generate
```

If Prisma asks about data loss, stop and read the prompt carefully before confirming.

### 6. Seed Demo Data

macOS / Linux / Git Bash:

```sh
cd path/to/project/backend
DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test' node ../database/seeds/seed.mjs
```

Windows PowerShell:

```powershell
cd path\to\project\backend
$env:DATABASE_URL = 'postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test'
node ..\database\seeds\seed.mjs
```

### 7. Create A Real UI Login Account

The demo seed data may include placeholder password hashes. Use this command to create known admin and driver accounts for UI testing.

macOS / Linux / Git Bash:

```sh
cd path/to/project/backend
DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test' node --input-type=module -e 'import { PrismaClient } from "@prisma/client"; import bcrypt from "bcryptjs"; const prisma = new PrismaClient(); const adminPasswordHash = await bcrypt.hash("ui-admin-password", 12); const driverPasswordHash = await bcrypt.hash("ui-driver-password", 12); await prisma.user.upsert({ where: { email: "ui-admin@example.test" }, update: { name: "UI Test Admin", universityId: "UIADMIN001", passwordHash: adminPasswordHash, role: "admin", accountStatus: "active" }, create: { name: "UI Test Admin", universityId: "UIADMIN001", email: "ui-admin@example.test", passwordHash: adminPasswordHash, role: "admin", accountStatus: "active" } }); const driver = await prisma.user.upsert({ where: { email: "ui-driver@example.test" }, update: { name: "UI Test Driver", universityId: "UITEST001", passwordHash: driverPasswordHash, role: "driver", accountStatus: "active" }, create: { name: "UI Test Driver", universityId: "UITEST001", email: "ui-driver@example.test", passwordHash: driverPasswordHash, role: "driver", accountStatus: "active" } }); await prisma.vehicleProfile.upsert({ where: { licensePlate: "UIT-001" }, update: { userId: driver.id, vehicleMake: "Toyota", vehicleModel: "Corolla", vehicleColor: "White", isPrimary: true }, create: { userId: driver.id, licensePlate: "UIT-001", vehicleMake: "Toyota", vehicleModel: "Corolla", vehicleColor: "White", isPrimary: true } }); console.log("Admin and driver test accounts ready"); await prisma.$disconnect();'
```

Windows PowerShell:

```powershell
cd path\to\project\backend
$env:DATABASE_URL = 'postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test'
node --input-type=module -e "import { PrismaClient } from '@prisma/client'; import bcrypt from 'bcryptjs'; const prisma = new PrismaClient(); const adminPasswordHash = await bcrypt.hash('ui-admin-password', 12); const driverPasswordHash = await bcrypt.hash('ui-driver-password', 12); await prisma.user.upsert({ where: { email: 'ui-admin@example.test' }, update: { name: 'UI Test Admin', universityId: 'UIADMIN001', passwordHash: adminPasswordHash, role: 'admin', accountStatus: 'active' }, create: { name: 'UI Test Admin', universityId: 'UIADMIN001', email: 'ui-admin@example.test', passwordHash: adminPasswordHash, role: 'admin', accountStatus: 'active' } }); const driver = await prisma.user.upsert({ where: { email: 'ui-driver@example.test' }, update: { name: 'UI Test Driver', universityId: 'UITEST001', passwordHash: driverPasswordHash, role: 'driver', accountStatus: 'active' }, create: { name: 'UI Test Driver', universityId: 'UITEST001', email: 'ui-driver@example.test', passwordHash: driverPasswordHash, role: 'driver', accountStatus: 'active' } }); await prisma.vehicleProfile.upsert({ where: { licensePlate: 'UIT-001' }, update: { userId: driver.id, vehicleMake: 'Toyota', vehicleModel: 'Corolla', vehicleColor: 'White', isPrimary: true }, create: { userId: driver.id, licensePlate: 'UIT-001', vehicleMake: 'Toyota', vehicleModel: 'Corolla', vehicleColor: 'White', isPrimary: true } }); console.log('Admin and driver test accounts ready'); await prisma.`$disconnect();"
```

UI test login:

```txt
Admin email: ui-admin@example.test
Admin password: ui-admin-password
Admin role: admin

Driver email: ui-driver@example.test
Driver password: ui-driver-password
Driver role: driver
Driver vehicle: UIT-001
```

### 8. Optional: Add Analytics Occupancy History Samples

Use this optional step when the Admin Analytics page shows:

```txt
No occupancy trend samples are available for this range.
```

The analytics trend and peak-hour panels use `OccupancyHistory` records. This command adds a richer manual-test dataset for the first few parking zones in your local database. It creates samples for today, the last 7 days, and the last 30 days, so the `Today`, `Last 7 days`, and `Last 30 days` filters all have data.

macOS / Linux / Git Bash:

```sh
cd path/to/project/backend
DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test' node --input-type=module <<'NODE'
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const zones = await prisma.parkingZone.findMany({
  orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  take: 3,
});

if (zones.length === 0) {
  throw new Error("No parking zones found. Run the seed step first.");
}

const now = new Date();
const samplePlan = [
  { daysAgo: 0, hour: 8, occupiedRate: 0.35, reservedRate: 0.08 },
  { daysAgo: 0, hour: 10, occupiedRate: 0.52, reservedRate: 0.1 },
  { daysAgo: 0, hour: 13, occupiedRate: 0.68, reservedRate: 0.12 },
  { daysAgo: 0, hour: 17, occupiedRate: 0.82, reservedRate: 0.1 },
  { daysAgo: 1, hour: 9, occupiedRate: 0.46, reservedRate: 0.08 },
  { daysAgo: 3, hour: 12, occupiedRate: 0.61, reservedRate: 0.09 },
  { daysAgo: 6, hour: 16, occupiedRate: 0.74, reservedRate: 0.11 },
  { daysAgo: 14, hour: 11, occupiedRate: 0.48, reservedRate: 0.07 },
  { daysAgo: 21, hour: 15, occupiedRate: 0.7, reservedRate: 0.09 },
  { daysAgo: 28, hour: 18, occupiedRate: 0.58, reservedRate: 0.08 },
];

const samples = zones.flatMap((zone, zoneIndex) =>
  samplePlan.map((plan) => {
    const recordedAt = new Date(now);
    recordedAt.setDate(now.getDate() - plan.daysAgo);
    recordedAt.setHours(plan.hour, zoneIndex * 5, 0, 0);

    const capacity = Math.max(zone.capacity, 1);
    const occupiedSpots = Math.min(
      capacity,
      Math.round(capacity * Math.min(plan.occupiedRate + zoneIndex * 0.04, 0.9)),
    );
    const reservedSpots = Math.min(
      capacity - occupiedSpots,
      Math.round(capacity * plan.reservedRate),
    );
    const availableSpots = Math.max(capacity - occupiedSpots - reservedSpots, 0);
    const occupancyRate = (((occupiedSpots + reservedSpots) / capacity) * 100).toFixed(2);

    return {
      zoneId: zone.id,
      recordedAt,
      capacity,
      availableSpots,
      occupiedSpots,
      reservedSpots,
      occupancyRate,
    };
  }),
);

await prisma.occupancyHistory.createMany({ data: samples });
console.log(`Created ${samples.length} occupancy history samples across ${zones.length} zone(s).`);
await prisma.$disconnect();
NODE
```

Windows PowerShell:

```powershell
cd path\to\project\backend
$env:DATABASE_URL = 'postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test'
@'
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const zones = await prisma.parkingZone.findMany({
  orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  take: 3,
});

if (zones.length === 0) {
  throw new Error("No parking zones found. Run the seed step first.");
}

const now = new Date();
const samplePlan = [
  { daysAgo: 0, hour: 8, occupiedRate: 0.35, reservedRate: 0.08 },
  { daysAgo: 0, hour: 10, occupiedRate: 0.52, reservedRate: 0.1 },
  { daysAgo: 0, hour: 13, occupiedRate: 0.68, reservedRate: 0.12 },
  { daysAgo: 0, hour: 17, occupiedRate: 0.82, reservedRate: 0.1 },
  { daysAgo: 1, hour: 9, occupiedRate: 0.46, reservedRate: 0.08 },
  { daysAgo: 3, hour: 12, occupiedRate: 0.61, reservedRate: 0.09 },
  { daysAgo: 6, hour: 16, occupiedRate: 0.74, reservedRate: 0.11 },
  { daysAgo: 14, hour: 11, occupiedRate: 0.48, reservedRate: 0.07 },
  { daysAgo: 21, hour: 15, occupiedRate: 0.7, reservedRate: 0.09 },
  { daysAgo: 28, hour: 18, occupiedRate: 0.58, reservedRate: 0.08 },
];

const samples = zones.flatMap((zone, zoneIndex) =>
  samplePlan.map((plan) => {
    const recordedAt = new Date(now);
    recordedAt.setDate(now.getDate() - plan.daysAgo);
    recordedAt.setHours(plan.hour, zoneIndex * 5, 0, 0);

    const capacity = Math.max(zone.capacity, 1);
    const occupiedSpots = Math.min(capacity, Math.round(capacity * Math.min(plan.occupiedRate + zoneIndex * 0.04, 0.9)));
    const reservedSpots = Math.min(capacity - occupiedSpots, Math.round(capacity * plan.reservedRate));
    const availableSpots = Math.max(capacity - occupiedSpots - reservedSpots, 0);
    const occupancyRate = (((occupiedSpots + reservedSpots) / capacity) * 100).toFixed(2);

    return { zoneId: zone.id, recordedAt, capacity, availableSpots, occupiedSpots, reservedSpots, occupancyRate };
  }),
);

await prisma.occupancyHistory.createMany({ data: samples });
console.log(`Created ${samples.length} occupancy history samples across ${zones.length} zone(s).`);
await prisma.$disconnect();
'@ | node --input-type=module
```

Manual check:

```txt
1. Start PostgreSQL, backend, and frontend.
2. Log in as ui-admin@example.test.
3. Open Admin > Analytics.
4. Check Today, Last 7 days, and Last 30 days.
5. The Lot Utilisation Over Time and Peak Hours sections should now show sample data.
```

## Run The App

Use three terminals.

### Terminal 1: PostgreSQL

Start PostgreSQL if it is not already running.

macOS manual start:

```sh
postgres -D /opt/homebrew/var/postgresql@14 -p 55432
```

Windows service:

```powershell
net start postgresql
```

### Terminal 2: Backend

macOS / Linux / Git Bash:

```sh
cd path/to/project/backend
export DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test'
export AUTH_TOKEN_SECRET='local-dev-secret'
export AUTH_SESSION_SECRET='local-dev-secret'
export AUTH_TOKEN_EXPIRES_IN='1h'
npm start
```

Windows PowerShell:

```powershell
cd path\to\project\backend
$env:DATABASE_URL = 'postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test'
$env:AUTH_TOKEN_SECRET = 'local-dev-secret'
$env:AUTH_SESSION_SECRET = 'local-dev-secret'
$env:AUTH_TOKEN_EXPIRES_IN = '1h'
npm start
```

Expected:

```txt
Smart Parking backend listening on port 3000
```

### Terminal 3: Frontend

macOS / Linux / Git Bash:

```sh
cd path/to/project/frontend
npm run dev -- --host 127.0.0.1
```

Windows PowerShell:

```powershell
cd path\to\project\frontend
npm run dev -- --host 127.0.0.1
```

Open:

```txt
http://127.0.0.1:5173
```

## Health Checks

Backend:

```sh
curl http://127.0.0.1:3000/health
```

Expected:

```json
{"status":"ok","database":"reachable"}
```

Protected route:

```sh
curl -i http://127.0.0.1:3000/api/parking-zones
```

Expected:

```txt
HTTP/1.1 401 Unauthorized
```

The `401` is correct for this check. It means the route exists and requires login.

## Tests And Builds

Frontend:

```sh
cd path/to/project/frontend
npm test
npm run build
```

Backend, macOS / Linux / Git Bash:

```sh
cd path/to/project/backend
DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test' AUTH_TOKEN_SECRET='local-dev-secret' AUTH_SESSION_SECRET='local-dev-secret' AUTH_TOKEN_EXPIRES_IN='1h' npm test
```

Backend, Windows PowerShell:

```powershell
cd path\to\project\backend
$env:DATABASE_URL = 'postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test'
$env:AUTH_TOKEN_SECRET = 'local-dev-secret'
$env:AUTH_SESSION_SECRET = 'local-dev-secret'
$env:AUTH_TOKEN_EXPIRES_IN = '1h'
npm test
```

## Common Errors

### Backend says `Missing script: "dev"`

Use:

```sh
npm start
```

### Browser says `127.0.0.1 refused to connect`

The server for that URL is not running.

Fix:

- Start the frontend for `http://127.0.0.1:5173`.
- Start the backend for `http://127.0.0.1:3000`.
- Use the exact URL printed by the frontend terminal if Vite chooses a different port.

### Frontend says the API is unreachable

Check backend health:

```sh
curl http://127.0.0.1:3000/health
```

If this fails, start or restart the backend.

### Frontend shows a `500` API error

The backend route crashed.

Fix:

1. Look at the backend terminal.
2. Read the first error above the stack trace.
3. If it mentions Prisma validation, missing tables, or missing columns, run:

```sh
cd path/to/project/backend
DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test' npx prisma db push --schema prisma/schema.prisma
DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test' npx prisma generate
```

Then restart the backend.

### Prisma `P1001`

Prisma cannot reach PostgreSQL.

Fix:

- Start PostgreSQL.
- Check the host and port in the database URL.
- Run `pg_isready -h 127.0.0.1 -p 55432`.

### Prisma `P1000`

Prisma reached PostgreSQL, but the username or password is wrong.

Fix: correct the database URL.

### Prisma `P2021` or `P2022`

The database schema is missing tables or columns.

Fix:

```sh
cd path/to/project/backend
DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test' npx prisma db push --schema prisma/schema.prisma
DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test' npx prisma generate
```

Then restart the backend.

### Prisma `P3005`

This can happen if `prisma migrate deploy` is run against a non-empty local database with no migration history.

For local setup, use:

```sh
cd path/to/project/backend
DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test' npx prisma db push --schema prisma/schema.prisma
DATABASE_URL='postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test' npx prisma generate
```

### Port `3000` is already in use

macOS / Linux:

```sh
lsof -i :3000
kill <PID>
```

Windows PowerShell:

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Port `5173` is already in use

Vite may choose a new port automatically. Use the URL shown in the frontend terminal, or stop the old frontend process.

### Login fails for seeded users

Seeded demo users may not have real password hashes.

Fix: use one of the UI test accounts created above:

```txt
Admin: ui-admin@example.test / ui-admin-password
Driver: ui-driver@example.test / ui-driver-password
```

### Browser still shows old behavior

Restart both app servers:

1. Stop frontend with `Ctrl-C`.
2. Stop backend with `Ctrl-C`.
3. Start backend again.
4. Start frontend again.
5. Refresh the browser.

## Safe Shutdown

### macOS / Linux / Git Bash

1. Press `Ctrl-C` in the frontend terminal.
2. Press `Ctrl-C` in the backend terminal.
3. Press `Ctrl-C` in the PostgreSQL terminal if you started it manually.

Check ports:

```sh
lsof -i :3000
lsof -i :5173
```

Stop a stuck process:

```sh
kill <PID>
```

### Windows PowerShell

1. Press `Ctrl+C` in the frontend terminal.
2. Press `Ctrl+C` in the backend terminal.
3. Type `Y` if PowerShell asks to terminate the batch job.

Check ports:

```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :5173
```

Stop a stuck process:

```powershell
taskkill /PID <PID> /F
```

Optional PostgreSQL service stop:

```powershell
net stop postgresql
```

## Fresh Restart Checklist

Use this when all terminals were closed or the app is in a bad state:

1. Start PostgreSQL.
2. Run `pg_isready -h 127.0.0.1 -p 55432`.
3. From `backend`, run `npx prisma db push --schema prisma/schema.prisma`.
4. From `backend`, run `npx prisma generate`.
5. Start backend with `npm start`.
6. Check `curl http://127.0.0.1:3000/health`.
7. Start frontend with `npm run dev -- --host 127.0.0.1`.
8. Open `http://127.0.0.1:5173`.
9. Log in with `ui-admin@example.test` / `ui-admin-password` for admin testing, or `ui-driver@example.test` / `ui-driver-password` for driver testing.
