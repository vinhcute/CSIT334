import assert from "node:assert/strict";
import test from "node:test";

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0);
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

async function requestHealth(app) {
  const server = await listen(app);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = await response.json();

    return { statusCode: response.status, body };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("GET /health returns ok when the database is reachable", async () => {
  const { createApp } = await import("../dist/index.js");
  const result = await requestHealth(createApp());

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    status: "ok",
    database: "reachable",
  });
});

test("GET /health reports unhealthy when the database is unavailable", async () => {
  const { createApp } = await import("../dist/index.js");
  const healthService = {
    checkHealth: async () => ({
      status: "unhealthy",
      database: "unreachable",
    }),
  };

  const result = await requestHealth(createApp({ healthService }));

  assert.equal(result.statusCode, 503);
  assert.deepEqual(result.body, {
    status: "unhealthy",
    database: "unreachable",
  });
});
