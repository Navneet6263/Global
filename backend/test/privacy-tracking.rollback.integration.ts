import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/database/prisma.service";
import { PrivacyQueryService } from "../src/privacy/privacy-query.service";
import { PrivacyService } from "../src/privacy/privacy.service";
import { deliveryWorkflowFixture } from "./helpers/delivery-workflow-fixture";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const prisma = new PrismaClient({
  adapter: new PrismaMssql({
    server: required("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 1433),
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate:
        process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    },
    pool: { max: 1, min: 0 },
  }),
});
const tenantCode = `PRIVACY_${randomUUID().slice(0, 12)}`;
const sentinel = new Error("ROLLBACK_PRIVACY_SUCCESS");

async function run(tx: Prisma.TransactionClient) {
  const db = new Proxy(tx, {
    get(target, property) {
      if (property === "$transaction")
        return (
          work:
            | ((client: Prisma.TransactionClient) => Promise<unknown>)
            | Promise<unknown>[],
        ) => (typeof work === "function" ? work(tx) : Promise.all(work));
      return Reflect.get(target, property);
    },
  }) as unknown as PrismaService;
  const f = await deliveryWorkflowFixture(tx, tenantCode);
  const admin = { ...f.manager, roles: ["PLATFORM_ADMIN"] };
  const records = new PrivacyService(db);
  const query = new PrivacyQueryService(db);
  const request = await records.create(admin, {
    kind: "DATA_REQUEST",
    requestType: "ERASURE",
    subjectReference: f.row.caseNumber,
    title: "Synthetic erasure review",
    description:
      "Rollback-only request; record an authorised decision without deleting any subject data.",
  });
  assert.equal(request.status, "RECEIVED");
  const reviewing = await records.update(admin, request.id, {
    version: request.version,
    status: "IN_REVIEW",
    note: "Synthetic identity and request scope review has started.",
  });
  await assert.rejects(
    records.update(admin, request.id, {
      version: request.version,
      status: "APPROVED",
      note: "This stale decision must never overwrite the current version.",
    }),
    /changed/,
  );
  const approved = await records.update(admin, request.id, {
    version: reviewing.version,
    status: "APPROVED",
    note: "Synthetic human decision recorded after request scope review.",
  });
  await assert.rejects(
    records.update(admin, request.id, {
      version: approved.version,
      status: "FULFILLED",
      note: "Missing completion evidence must prevent final status.",
    }),
    /evidence reference/,
  );
  const complete = await records.update(admin, request.id, {
    version: approved.version,
    status: "FULFILLED",
    note: "Synthetic external work completion recorded for rollback testing only.",
    evidenceReference: "TEST-TRACKING-ONLY",
  });
  assert.equal(complete.version, 4);
  assert.equal(await tx.subject.count({ where: { tenantId: f.tenant.id } }), 1);
  assert.equal(
    await tx.document.count({ where: { tenantId: f.tenant.id } }),
    1,
  );
  assert.equal(
    await tx.outboxEvent.count({ where: { tenantId: f.tenant.id } }),
    0,
  );

  const incident = await records.create(admin, {
    kind: "INCIDENT",
    severity: "HIGH",
    title: "Synthetic privacy incident",
    description:
      "Rollback-only incident tracking; no real security incident occurred.",
  });
  const investigating = await records.update(admin, incident.id, {
    version: incident.version,
    status: "INVESTIGATING",
    note: "Synthetic incident investigation started by the recorded administrator.",
  });
  const contained = await records.update(admin, incident.id, {
    version: investigating.version,
    status: "CONTAINED",
    note: "Synthetic containment actions recorded as completed outside this tracker.",
  });
  await records.update(admin, incident.id, {
    version: contained.version,
    status: "CLOSED",
    note: "Synthetic incident closure reviewed with a supporting internal reference.",
    evidenceReference: "TEST-INCIDENT-CLOSE",
  });

  const page = await query.list(admin, {
    kind: "DATA_REQUEST",
    status: "FULFILLED",
    search: "erasure",
    page: 1,
    pageSize: 1,
  });
  assert.equal(page.total, 1);
  assert.equal(page.items[0]?.id, request.id);
  const detail = await query.get(admin, request.id);
  assert.equal(detail.updatedBy.publicId, admin.userPublicId);
  assert.ok(detail.completedAt);
  const timeline = await query.events(admin, request.id, {
    page: 2,
    pageSize: 2,
  });
  assert.equal(timeline.total, 4);
  assert.equal(timeline.items.length, 2);
  assert.ok(
    timeline.items.every(
      (event) => event.actor?.publicId === admin.userPublicId,
    ),
  );
  const foreign = { ...admin, tenantId: -1n };
  assert.equal((await query.list(foreign, { page: 1, pageSize: 12 })).total, 0);
  await assert.rejects(query.get(foreign, request.id), /not found/);
  await assert.rejects(
    query.events(f.verifier, request.id, { page: 1, pageSize: 12 }),
    /platform administrators/,
  );
  assert.equal(
    await tx.auditEvent.count({
      where: { tenantId: f.tenant.id, resourceType: "privacy_record" },
    }),
    8,
  );
  throw sentinel;
}

async function main() {
  try {
    let failure: unknown;
    try {
      await prisma.$transaction(run, {
        timeout: 120_000,
        maxWait: 10_000,
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (error !== sentinel) failure = error;
    }
    assert.equal(await prisma.tenant.count({ where: { code: tenantCode } }), 0);
    if (failure)
      throw failure instanceof Error
        ? failure
        : new Error("Privacy integration failed", { cause: failure });
    console.log(
      "PASS: real SQL privacy request/incident lifecycles, role/tenant boundaries, audit/pagination; no deletion or delivery; fixture tenant rows after rollback: 0.",
    );
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Privacy integration failed",
  );
  process.exitCode = 1;
});
