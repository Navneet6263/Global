import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { networkLocationLabel } from "../src/common/http/network-location";
import { assertSafeRoleCombination } from "../src/users/role-combination";

void test("single roles and explicitly confirmed internal combinations are accepted", () => {
  assert.doesNotThrow(() => assertSafeRoleCombination(["SALES_MANAGER"]));
  assert.doesNotThrow(() =>
    assertSafeRoleCombination(["OPS_MANAGER", "QA_REVIEWER"], true),
  );
});

void test("implicit, platform-admin and client-admin combinations are rejected", () => {
  for (const [roles, confirmed] of [
    [["SALES_MANAGER", "FINANCE_MANAGER"], false],
    [["PLATFORM_ADMIN", "SALES_MANAGER"], true],
    [["CLIENT_ADMIN", "VERIFIER"], true],
  ] as const) {
    assert.throws(
      () => assertSafeRoleCombination(roles, confirmed),
      ConflictException,
    );
  }
});

void test("network labels are honest for local, private and trusted public locations", () => {
  assert.equal(networkLocationLabel("127.0.0.1"), "Local device");
  assert.equal(networkLocationLabel(), "Location unavailable");
  assert.equal(networkLocationLabel("192.168.1.5"), "Internal network");
  assert.equal(
    networkLocationLabel("8.8.8.8"),
    "Approximate location unavailable",
  );
  assert.equal(
    networkLocationLabel("8.8.8.8", "Agra, Uttar Pradesh, IN"),
    "Agra, Uttar Pradesh, IN",
  );
});
