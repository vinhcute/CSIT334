import express from "express";
import { pathToFileURL } from "node:url";
import { getEnv } from "./config/env.js";
import { createAdminUsersRouter } from "./routes/adminUsers.js";
import { createAuthRouter } from "./routes/auth.js";
import { createHealthRouter } from "./routes/health.js";
import { createPasswordRouter } from "./routes/password.js";
import { createSubscriptionsRouter } from "./routes/subscriptions.js";
import { createUsersRouter } from "./routes/users.js";
import { createVehicleProfilesRouter } from "./routes/vehicleProfiles.js";
import type { HealthChecker } from "./services/healthService.js";

export interface AppDependencies {
  healthService?: HealthChecker;
}

export function createApp(dependencies: AppDependencies = {}): express.Express {
  const app = express();

  app.use(express.json());
  app.use(createHealthRouter(dependencies.healthService));
  app.use(createAuthRouter());
  app.use(createUsersRouter());
  app.use(createVehicleProfilesRouter());
  app.use(createSubscriptionsRouter());
  app.use(createPasswordRouter());
  app.use(createAdminUsersRouter());

  return app;
}

function isDirectRun(): boolean {
  const entryPoint = process.argv[1];

  return Boolean(entryPoint && import.meta.url === pathToFileURL(entryPoint).href);
}

if (isDirectRun()) {
  const { port } = getEnv();
  const app = createApp();

  app.listen(port, () => {
    console.log(`Smart Parking backend listening on port ${port}`);
  });
}
