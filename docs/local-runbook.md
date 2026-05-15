# Local Runbook

Use this guide when setting up UniPark on a new machine or after pulling fresh code.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL
- Two terminal windows: one for the backend and one for the frontend

The examples below use:

```sh
DATABASE_URL=postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test
AUTH_TOKEN_SECRET=local-dev-secret
AUTH_SESSION_SECRET=local-dev-secret
AUTH_TOKEN_EXPIRES_IN=1h
```

Use your own `DATABASE_URL` if your PostgreSQL server runs on another port or database name.

## First-Time Setup

Install dependencies:

```sh
cd backend
npm install

cd ../frontend
npm install
```

Create or start PostgreSQL, then create a database and user that match your `DATABASE_URL`.

For a local PostgreSQL server, the database must be reachable before running backend commands. Verify it with:

```sh
pg_isready -h 127.0.0.1 -p 55432
```

Apply the Prisma schema:

```sh
cd backend
DATABASE_URL=postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test \
npx prisma db push --schema prisma/schema.prisma
```

Seed demo data:

```sh
cd backend
DATABASE_URL=postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test \
node ../database/seeds/seed.mjs
```

The seed file creates demo records, but its seeded user password hashes are placeholders. Create a real UI admin account for login testing:

```sh
cd backend
DATABASE_URL=postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test \
node --input-type=module -e 'import { PrismaClient } from "@prisma/client"; import bcrypt from "bcryptjs"; const prisma = new PrismaClient(); await prisma.user.upsert({ where: { email: "ui-admin@example.test" }, update: { name: "UI Test Admin", universityId: "UIADMIN001", passwordHash: await bcrypt.hash("ui-admin-password", 12), role: "admin", accountStatus: "active" }, create: { name: "UI Test Admin", universityId: "UIADMIN001", email: "ui-admin@example.test", passwordHash: await bcrypt.hash("ui-admin-password", 12), role: "admin", accountStatus: "active" } }); console.log("Admin test account ready"); await prisma.$disconnect();'
```

Login details:

```txt
Email: ui-admin@example.test
Password: ui-admin-password
```

## Run The App

Terminal 1, backend:

```sh
cd backend
DATABASE_URL=postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test \
AUTH_TOKEN_SECRET=local-dev-secret \
AUTH_SESSION_SECRET=local-dev-secret \
AUTH_TOKEN_EXPIRES_IN=1h \
npm start
```

Expected output:

```txt
Smart Parking backend listening on port 3000
```

Terminal 2, frontend:

```sh
cd frontend
npm run dev -- --host 127.0.0.1
```

Open:

```txt
http://127.0.0.1:5173
```

The frontend uses the Vite proxy in `frontend/vite.config.ts` to send `/api` requests to `http://127.0.0.1:3000`.

## Quick Health Checks

Backend health:

```sh
curl http://127.0.0.1:3000/health
```

Expected:

```json
{"status":"ok","database":"reachable"}
```

Protected parking routes without a token:

```sh
curl -i http://127.0.0.1:3000/api/parking-zones
curl -i http://127.0.0.1:3000/api/parking-spots
```

Expected:

```txt
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
```

A `401` JSON response is good here. It means the route exists and auth is protecting it.

## Run Tests

Frontend:

```sh
cd frontend
npm test
npm run build
```

Backend:

```sh
cd backend
DATABASE_URL=postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test \
AUTH_TOKEN_SECRET=local-dev-secret \
AUTH_SESSION_SECRET=local-dev-secret \
AUTH_TOKEN_EXPIRES_IN=1h \
npm test
```

Use a test database for backend tests because route tests create and delete records.

## Common Errors

### `Unable to reach the parking API`

The frontend cannot connect to the backend.

Fix:

```sh
curl http://127.0.0.1:3000/health
```

If this fails, start the backend. If the backend is running on another port, update `frontend/vite.config.ts` or start the backend on port `3000`.

### `The parking API returned a non-JSON response`

The backend is reachable, but it returned HTML instead of JSON. This usually means the running backend process is stale and was started before the newest routes were compiled.

Fix:

1. Stop the backend terminal with `Ctrl-C`.
2. Start it again with `npm start`.
3. Retry the page.

`npm start` now runs a build first, so restarting should load the latest routes.

### `Cannot GET /api/parking-zones` or `Cannot GET /api/parking-spots`

The live backend does not have the parking routes in memory.

Fix:

```sh
cd backend
npm run build
```

Then stop and restart the backend process.

### `{"status":"ok","database":"unreachable"}`

The backend is running, but it cannot connect to PostgreSQL.

Fix:

- Make sure PostgreSQL is running.
- Check the host and port in `DATABASE_URL`.
- Check the database name, username, and password.
- Run `pg_isready -h 127.0.0.1 -p 55432`.

### Prisma `P1001`

Prisma cannot reach the database server.

Fix: start PostgreSQL and verify `DATABASE_URL`.

### Prisma `P1000`

Prisma reached PostgreSQL, but authentication failed.

Fix: correct the username or password in `DATABASE_URL`.

### Prisma `P2021` or `P2022`

The database schema is missing tables or columns.

Fix:

```sh
cd backend
DATABASE_URL=postgresql://smart_parking_user:change_me@127.0.0.1:55432/smart_parking_test \
npx prisma db push --schema prisma/schema.prisma
```

Then restart the backend.

### `EADDRINUSE: address already in use :::3000`

Another process is already using backend port `3000`.

Fix:

```sh
lsof -i :3000
```

Stop the old backend process, or run the backend with a different `PORT` and update the frontend proxy.

### Frontend port `5173` is already in use

Vite may choose another port automatically. Use the URL shown in the frontend terminal, or stop the old frontend process.

### Login fails for seeded demo users

Seeded users such as `admin001@example.test` have placeholder password hashes and cannot log in.

Fix: use the `ui-admin@example.test` account created in this runbook, or create another user with a real bcrypt password hash.

### `Authentication required.`

The backend route exists, but the request has no valid auth token.

Fix: log in through the UI again. If the browser has an old token, log out or clear local storage for `127.0.0.1:5173`.

### `Permission denied`

You are logged in as a non-admin user.

Fix: log in with `ui-admin@example.test`.

### Vite says `Could not Fast Refresh`

This can happen after adding or changing exported helpers in React files.

Fix: refresh the browser page. If it persists, stop and restart the frontend dev server.

### Browser still shows old behavior after a fix

One of the dev servers is stale.

Fix:

1. Stop backend and frontend with `Ctrl-C`.
2. Start the backend again.
3. Start the frontend again.
4. Refresh the browser.

