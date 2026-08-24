import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../src/auth/password";

void test("password hashes are salted and verifiable", async () => {
  const first = await hashPassword("A-strong-demo-password");
  const second = await hashPassword("A-strong-demo-password");

  assert.notEqual(first, second);
  assert.equal(await verifyPassword("A-strong-demo-password", first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
});
