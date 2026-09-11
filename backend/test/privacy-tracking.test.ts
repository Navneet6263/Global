import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { PERMISSIONS_KEY, ROLES_KEY } from "../src/common/auth/auth.decorators";
import { PrivacyController } from "../src/privacy/privacy.controller";
import { PrivacyService } from "../src/privacy/privacy.service";
import { privacyTransition } from "../src/privacy/privacy-policy";

const actor = { userId: 9n, tenantId: 3n, roles: ["PLATFORM_ADMIN"] } as Actor;
const note = "Identity and scope reviewed by the authorised privacy reviewer.";
const request = {
  kind: "DATA_REQUEST",
  title: "Access request",
  description: "Candidate asked for access to their verification record.",
  subjectReference: "SG-REF-123",
  requestType: "ACCESS",
};

void test("privacy controller requires platform administrator and settings permission", () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, PrivacyController), [
    "PLATFORM_ADMIN",
  ]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, PrivacyController), [
    "settings:manage",
  ]);
});

void test("privacy states cannot skip review or jump between workflows", () => {
  assert.throws(
    () =>
      privacyTransition(
        "DATA_REQUEST",
        "RECEIVED",
        "FULFILLED",
        note,
        "TICKET-1",
      ),
    /cannot move/,
  );
  assert.throws(
    () => privacyTransition("INCIDENT", "OPEN", "APPROVED", note),
    /cannot move/,
  );
  assert.throws(
    () => privacyTransition("DATA_REQUEST", "FULFILLED", "IN_REVIEW", note),
    /cannot move/,
  );
  assert.throws(
    () =>
      privacyTransition("DATA_REQUEST", "RECEIVED", "IN_REVIEW", "           "),
    /rationale/,
  );
  assert.throws(
    () => privacyTransition("DATA_REQUEST", "APPROVED", "FULFILLED", note),
    /evidence reference/,
  );
  assert.throws(
    () => privacyTransition("INCIDENT", "CONTAINED", "CLOSED", note),
    /evidence reference/,
  );
  assert.equal(
    privacyTransition("INCIDENT", "CONTAINED", "INVESTIGATING", note).rationale,
    note,
  );
});

void test("non-admin cannot create or decide privacy records even through the service", async () => {
  const service = new PrivacyService({} as PrismaService);
  const verifier = { ...actor, roles: ["VERIFIER"] };
  await assert.rejects(
    service.create(verifier, request),
    /platform administrators/,
  );
  await assert.rejects(
    service.update(verifier, "record", {
      version: 1,
      status: "IN_REVIEW",
      note,
    }),
    /platform administrators/,
  );
});

void test("data requests need subject reference and incidents need severity", async () => {
  const service = new PrivacyService({} as PrismaService);
  await assert.rejects(
    service.create(actor, { ...request, subjectReference: "   " }),
    /short subject/,
  );
  await assert.rejects(
    service.create(actor, {
      ...request,
      kind: "INCIDENT",
      requestType: undefined,
    }),
    /severity/,
  );
  await assert.rejects(
    service.create(actor, { ...request, severity: "HIGH" }),
    /severity belongs/,
  );
});

function updating(version = 4, matches = 1, missing = false) {
  const writes: Array<{ kind: string; input: unknown }> = [];
  const tx = {
    privacyRecord: {
      findFirst: (input: unknown) => {
        writes.push({ kind: "read", input });
        return Promise.resolve(
          missing
            ? null
            : {
                id: 12n,
                publicId: "record",
                tenantId: 3n,
                kind: "DATA_REQUEST",
                status: "APPROVED",
                version,
                evidenceReference: null,
                resolutionNote: "Initial identity review complete",
              },
        );
      },
      updateMany: (input: unknown) => {
        writes.push({ kind: "update", input });
        return Promise.resolve({ count: matches });
      },
    },
    auditEvent: {
      create: (input: unknown) => {
        writes.push({ kind: "audit", input });
        return Promise.resolve({});
      },
    },
  };
  const prisma = {
    $transaction: (work: (db: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  return { service: new PrivacyService(prisma), writes };
}

void test("stale or cross-tenant privacy writes never produce a decision event", async () => {
  const old = updating(5);
  await assert.rejects(
    old.service.update(actor, "record", {
      version: 4,
      status: "FULFILLED",
      note,
      evidenceReference: "TICKET-1",
    }),
    /changed/,
  );
  assert.deepEqual(
    old.writes.map((item) => item.kind),
    ["read"],
  );
  const absent = updating(4, 1, true);
  await assert.rejects(
    absent.service.update(actor, "record", {
      version: 4,
      status: "FULFILLED",
      note,
      evidenceReference: "TICKET-1",
    }),
    /not found/,
  );
  assert.deepEqual(absent.writes[0]?.input, {
    where: { tenantId: actor.tenantId, publicId: "record" },
  });
  const raced = updating(4, 0);
  await assert.rejects(
    raced.service.update(actor, "record", {
      version: 4,
      status: "FULFILLED",
      note,
      evidenceReference: "TICKET-1",
    }),
    /concurrently/,
  );
  assert.equal(
    raced.writes.some((item) => item.kind === "audit"),
    false,
  );
});

void test("fulfilled request records actor, exact version and reference without erasing anything", async () => {
  const { service, writes } = updating();
  const result = await service.update(actor, "record", {
    version: 4,
    status: "FULFILLED",
    note,
    evidenceReference: "TICKET-1",
  });
  assert.equal(result.version, 5);
  assert.equal(result.status, "FULFILLED");
  assert.match(result.trackingNotice, /does not erase data/);
  assert.deepEqual(
    writes.map((item) => item.kind),
    ["read", "update", "audit"],
  );
  const mutation = writes[1]!.input as {
    where: { tenantId: bigint; version: number };
    data: { updatedById: bigint; evidenceReference: string };
  };
  assert.equal(mutation.where.tenantId, actor.tenantId);
  assert.equal(mutation.where.version, 4);
  assert.equal(mutation.data.updatedById, actor.userId);
  assert.equal(mutation.data.evidenceReference, "TICKET-1");
  const audit = writes[2]!.input as {
    data: { actorUserId: bigint; afterJson: string };
  };
  assert.equal(audit.data.actorUserId, actor.userId);
  assert.equal(
    (JSON.parse(audit.data.afterJson) as { trackingOnly: boolean })
      .trackingOnly,
    true,
  );
});
