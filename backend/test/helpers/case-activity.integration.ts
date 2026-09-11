import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PrismaService } from "../../src/database/prisma.service";
import { Prisma } from "../../src/generated/prisma/client";
import type { LocalObjectStorageService } from "../../src/documents/local-object-storage.service";
import { CaseActivityService } from "../../src/cases/case-activity.service";
import { ReportAccessService } from "../../src/reports/report-access.service";
import type { deliveryWorkflowFixture } from "./delivery-workflow-fixture";

export async function verifyCaseActivity(
  db: PrismaService,
  tx: Prisma.TransactionClient,
  storage: LocalObjectStorageService,
  fixture: Awaited<ReturnType<typeof deliveryWorkflowFixture>>,
  reportId: string,
) {
  const access = new ReportAccessService(db, storage);
  await access.preview(fixture.manager, reportId);
  await access.renew(fixture.manager, reportId);
  const activity = new CaseActivityService(db);
  const first = await activity.list(fixture.manager, fixture.row.publicId, {
    limit: 2,
    resource: "report",
  });
  assert.equal(first.items.length, 2);
  assert.ok(first.nextCursor);
  const second = await activity.list(fixture.manager, fixture.row.publicId, {
    limit: 2,
    resource: "report",
    cursor: first.nextCursor,
  });
  assert.ok(second.items.length);
  const combined = [...first.items, ...second.items];
  assert.equal(new Set(combined.map((item) => item.id)).size, combined.length);
  assert.ok(
    combined.some(
      (item) =>
        item.action === "report.internal-preview" &&
        item.actorName === fixture.manager.displayName,
    ),
  );
  assert.ok(
    combined.some((item) => item.action === "report.download-access-renewed"),
  );
  assert.ok(
    combined.some(
      (item) =>
        item.action === "report.downloaded" &&
        item.actorName === fixture.clientActor.displayName,
    ),
  );
  assert.deepEqual(Object.keys(first.items[0]!).sort(), [
    "action",
    "actorName",
    "createdAt",
    "id",
    "resourceType",
  ]);
  await assert.rejects(
    activity.list(fixture.clientActor, fixture.row.publicId, { limit: 15 }),
    /operations managers/,
  );
  await assert.rejects(
    activity.list({ ...fixture.manager, tenantId: -1n }, fixture.row.publicId, {
      limit: 15,
    }),
    /Case not found/,
  );
  const unrelated = await tx.auditEvent.create({
    data: {
      tenantId: fixture.tenant.id,
      actorUserId: fixture.manager.userId,
      action: "case.unrelated",
      resourceType: "case",
      resourcePublicId: randomUUID(),
      afterJson: '{"objectKey":"do-not-expose","token":"do-not-expose"}',
    },
  });
  const all = await activity.list(fixture.manager, fixture.row.publicId, {
    limit: 50,
  });
  assert.ok(!all.items.some((item) => item.id === unrelated.publicId));
  await assert.rejects(
    activity.list(fixture.manager, fixture.row.publicId, {
      limit: 15,
      cursor: unrelated.publicId,
    }),
    /return to the first page/,
  );
  await assertCursorPrecision(tx, activity, fixture);
}

async function assertCursorPrecision(
  tx: Prisma.TransactionClient,
  activity: CaseActivityService,
  fixture: Awaited<ReturnType<typeof deliveryWorkflowFixture>>,
) {
  const prefix = randomUUID().slice(0, -4);
  const ids = ["0001", "0002", "0003", "0004"].map(
    (ending) => `${prefix}${ending}`,
  );
  const times = [
    "2099-01-01T00:00:00.1234567",
    "2099-01-01T00:00:00.1234567",
    "2099-01-01T00:00:00.1234566",
    "2099-01-01T00:00:00.1234561",
  ];
  for (let index = 0; index < ids.length; index++) {
    await tx.$executeRaw(Prisma.sql`INSERT INTO [dbo].[AuditEvent]
      ([tenantId], [actorUserId], [publicId], [action], [resourceType], [resourcePublicId], [createdAt])
      VALUES (${fixture.tenant.id}, ${fixture.manager.userId}, CONVERT(uniqueidentifier, ${ids[index]}),
      'case.precision-test', 'case', ${fixture.row.publicId}, CONVERT(datetime2, ${times[index]}, 126))`);
  }
  const first = await activity.list(fixture.manager, fixture.row.publicId, {
    limit: 2,
    resource: "case",
  });
  assert.deepEqual(
    first.items.map((event) => event.id.toLowerCase()),
    [ids[1], ids[0]],
  );
  assert.ok(first.nextCursor);
  const second = await activity.list(fixture.manager, fixture.row.publicId, {
    limit: 2,
    resource: "case",
    cursor: first.nextCursor,
  });
  assert.deepEqual(
    second.items.map((event) => event.id.toLowerCase()),
    [ids[2], ids[3]],
  );
}
