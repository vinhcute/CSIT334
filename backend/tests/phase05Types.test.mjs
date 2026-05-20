import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Phase 05 DTO module is exported from the compiled domain package", async () => {
  await assert.doesNotReject(() => import("../dist/domain/phase05.js"));
  await assert.doesNotReject(() => import("../dist/domain/index.js"));
});

test("Phase 05 DTOs stay framework-free and omit sensitive response fields", async () => {
  const source = await readFile(new URL("../src/domain/phase05.ts", import.meta.url), "utf8");

  assert.equal(source.includes("express"), false);
  assert.equal(source.includes("@prisma/client"), false);
  assert.equal(source.includes("passwordHash"), false);
  assert.equal(source.includes("token"), false);
  assert.equal(source.includes("universityId"), false);
  assert.equal(source.includes("licensePlate"), false);
  assert.equal(source.includes("licencePlate"), false);
});
