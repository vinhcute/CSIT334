export interface AppEnv {
  port: number;
  databaseUrl?: string;
  authSessionSecret?: string;
  authTokenSecret?: string;
  authTokenExpiresIn: string;
}

export function getEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsedPort = Number(env.PORT ?? 3000);

  return {
    port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000,
    databaseUrl: env.DATABASE_URL,
    authSessionSecret: env.AUTH_SESSION_SECRET,
    authTokenSecret: env.AUTH_TOKEN_SECRET,
    authTokenExpiresIn: env.AUTH_TOKEN_EXPIRES_IN ?? "1h",
  };
}
