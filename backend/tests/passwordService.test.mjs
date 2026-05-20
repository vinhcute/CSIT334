import assert from "node:assert/strict";
import test from "node:test";

test("PasswordService hashes and verifies passwords", async () => {
  const { PasswordService } = await import("../dist/services/passwordService.js");
  const passwordService = new PasswordService();
  const password = "correct-password";

  const firstHash = await passwordService.hashPassword(password);
  const secondHash = await passwordService.hashPassword(password);

  assert.notEqual(firstHash, password);
  assert.notEqual(secondHash, password);
  assert.notEqual(firstHash, secondHash);
  assert.equal(await passwordService.verifyPassword(password, firstHash), true);
  assert.equal(await passwordService.verifyPassword("incorrect-password", firstHash), false);
});

test("PasswordService rejects passwords shorter than the minimum length", async () => {
  const { MIN_PASSWORD_LENGTH, PasswordService, PasswordValidationError } = await import(
    "../dist/services/passwordService.js"
  );
  const passwordService = new PasswordService();
  const shortPassword = "x".repeat(MIN_PASSWORD_LENGTH - 1);

  await assert.rejects(
    () => passwordService.hashPassword(shortPassword),
    PasswordValidationError,
  );
});
