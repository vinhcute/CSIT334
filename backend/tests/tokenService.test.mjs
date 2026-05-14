import assert from "node:assert/strict";
import test from "node:test";

const payload = {
  userId: "user-token-test",
  role: "driver",
  accountStatus: "active",
};

test("TokenService signs and verifies a valid token", async () => {
  const { TokenService } = await import("../dist/services/tokenService.js");
  const tokenService = new TokenService({
    secret: "test-secret",
    expiresIn: "1h",
  });

  const token = tokenService.signToken(payload);
  const verified = tokenService.verifyToken(token);

  assert.equal(verified.userId, payload.userId);
  assert.equal(verified.role, payload.role);
  assert.equal(verified.accountStatus, payload.accountStatus);
});

test("TokenService rejects a token signed with a different secret", async () => {
  const { TokenService, TokenVerificationError } = await import("../dist/services/tokenService.js");
  const signingService = new TokenService({
    secret: "signing-secret",
    expiresIn: "1h",
  });
  const verifyingService = new TokenService({
    secret: "verifying-secret",
    expiresIn: "1h",
  });

  const token = signingService.signToken(payload);

  assert.throws(() => verifyingService.verifyToken(token), TokenVerificationError);
});

test("TokenService rejects a malformed token", async () => {
  const { TokenService, TokenVerificationError } = await import("../dist/services/tokenService.js");
  const tokenService = new TokenService({
    secret: "test-secret",
    expiresIn: "1h",
  });

  assert.throws(() => tokenService.verifyToken("not-a-jwt"), TokenVerificationError);
});

test("TokenService rejects an expired token", async () => {
  const { TokenService, TokenVerificationError } = await import("../dist/services/tokenService.js");
  const tokenService = new TokenService({
    secret: "test-secret",
    expiresIn: "1ms",
  });

  const token = tokenService.signToken(payload);
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.throws(() => tokenService.verifyToken(token), TokenVerificationError);
});
