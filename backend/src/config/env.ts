export interface AppEnv {
  port: number;
  databaseUrl?: string;
}

export function getEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsedPort = Number(env.PORT ?? 3000);

  return {
    port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000,
    databaseUrl: env.DATABASE_URL,
  };
}
