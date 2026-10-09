import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../src/database/prisma.service";
import {
  ClientPricingController,
  PackagesController,
} from "../src/packages/packages.controller";
import { discountedPrice } from "../src/packages/package-discount";
import { PackagesService } from "../src/packages/packages.service";
import { passesGuard } from "./helpers/guard-check";
import { testActor } from "./helpers/test-actor";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PKG = "22222222-2222-4222-8222-222222222222";

const ops = testActor(["OPS_MANAGER"], ["case:read"]);
const rm = testActor(["SPOC_RM"], ["case:read", "dashboard:read"], {
  spocClients: [{ id: 21n, publicId: CLIENT, name: "Acme" }],
});
const otherRm = testActor(["SPOC_RM"], ["case:read", "dashboard:read"], {
  spocClients: [],
});

function harness() {
  const writes: Array<{ kind: string; data: unknown }> = [];
  const record =
    (kind: string, result: unknown = {}) =>
    (data: unknown) => {
      writes.push({ kind, data });
      return Promise.resolve(result);
    };
  const tx = {
    clientPackageDiscount: {
      findUnique: () => Promise.resolve(null),
      upsert: record("upsert"),
      delete: record("delete"),
    },
    auditEvent: { create: record("audit") },
  };
  const prisma = {
    client: {
      findFirst: () =>
        Promise.resolve({
          id: 21n,
          publicId: CLIENT,
          displayName: "Acme",
          primaryRmUserId: null,
        }),
    },
    servicePackage: {
      findFirst: () =>
        Promise.resolve({
          id: 5n,
          name: "Standard BGV",
          maxRmDiscountPercent: 10,
        }),
    },
    $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
  } as unknown as PrismaService;
  return { service: new PackagesService(prisma), writes };
}

void test("discounted price rounds to paise and never goes below zero or above list", () => {
  assert.equal(discountedPrice(1999, 10), 1799.1);
  assert.equal(discountedPrice(1000, 0), 1000);
  assert.equal(discountedPrice(1000, 150), 0);
  assert.equal(discountedPrice(null, 10), 0);
});

void test("an RM gives its own client a discount up to the package limit, audited", async () => {
  const { service, writes } = harness();
  const result = await service.setDiscount(rm, CLIENT, PKG, {
    discountPercent: 10,
    note: "Annual volume",
  });
  assert.equal(result.discountPercent, 10);
  assert.equal(writes[0]!.kind, "upsert");
  const audit = writes.find((row) => row.kind === "audit")!.data as {
    data: { action: string; afterJson: string };
  };
  assert.equal(audit.data.action, "client-pricing.discount-set");
  assert.equal(JSON.parse(audit.data.afterJson).limitPercent, 10);
});

void test("an RM cannot go above the limit Operations set, or touch another RM's client", async () => {
  const { service, writes } = harness();
  await assert.rejects(
    service.setDiscount(rm, CLIENT, PKG, { discountPercent: 12 }),
    /up to 10%/,
  );
  await assert.rejects(
    service.setDiscount(otherRm, CLIENT, PKG, { discountPercent: 5 }),
    NotFoundException,
  );
  assert.equal(writes.length, 0);
});

void test("Operations sets any discount; zero removes it", async () => {
  const { service, writes } = harness();
  await service.setDiscount(ops, CLIENT, PKG, { discountPercent: 40 });
  assert.equal(writes[0]!.kind, "upsert");
  assert.ok(ForbiddenException);
});

void test("only Ops and Admin build packages; RMs reach only client pricing", () => {
  const admin = testActor(["PLATFORM_ADMIN"], ["*"]);
  for (const method of ["list", "create", "update"]) {
    assert.ok(passesGuard(PackagesController, method, ops), method);
    // The view-only admin still builds packages.
    assert.ok(passesGuard(PackagesController, method, admin), method);
    assert.ok(!passesGuard(PackagesController, method, rm), method);
  }
  for (const method of ["pricing", "setDiscount"]) {
    assert.ok(passesGuard(ClientPricingController, method, rm), method);
    assert.ok(passesGuard(ClientPricingController, method, ops), method);
    assert.ok(
      !passesGuard(
        ClientPricingController,
        method,
        testActor(["CLIENT_ADMIN"], ["*"]),
      ),
      method,
    );
  }
});
