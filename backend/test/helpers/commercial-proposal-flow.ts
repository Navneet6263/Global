import assert from "node:assert/strict";
import type { Prisma } from "../../src/generated/prisma/client";
import type { PrismaService } from "../../src/database/prisma.service";
import { CrmProposalService } from "../../src/crm/crm-proposal.service";
import { CrmSequenceController } from "../../src/crm/crm-sequence.controller";
import { CrmAutoAssignmentController } from "../../src/crm/crm-auto-assignment.controller";
import { CrmFollowUpService } from "../../src/crm/crm-follow-up.service";
import { proposalPdf } from "../../src/crm/crm-proposal-pdf";
import type { CommercialFixture } from "./rollback-database";

export async function commercialProposalFlow(
  tx: Prisma.TransactionClient,
  db: PrismaService,
  f: CommercialFixture,
) {
  const author = { ...f.manager, roles: ["SALES_MANAGER"] };
  const approver = { ...f.finance, roles: ["PLATFORM_ADMIN"] };
  const salesRole = await tx.role.create({
    data: {
      tenantId: f.tenant.id,
      code: "SALES_MANAGER",
      name: "Sales",
      permissionsJson: '["*"]',
    },
  });
  await tx.userRole.create({
    data: { userId: author.userId, roleId: salesRole.id },
  });
  const opportunity = await tx.salesOpportunity.create({
    data: {
      tenantId: f.tenant.id,
      clientId: f.client.id,
      companyName: "Synthetic proposal company",
      estimatedValue: 200.2,
      contactName: "Synthetic contact",
      stage: "QUALIFIED",
    },
  });
  const allocate = new CrmAutoAssignmentController(db);
  const assignment = await allocate.assign(author, opportunity.publicId, {
    version: opportunity.version,
  });
  assert.equal(assignment.ownerId, author.userPublicId);
  await assert.rejects(
    allocate.assign(author, opportunity.publicId, {
      version: assignment.version,
    }),
    /already has an owner/,
  );
  const proposals = new CrmProposalService(db);
  const pack = await tx.servicePackage.findUniqueOrThrow({
    where: { id: f.row.servicePackageId! },
  });
  const created = await proposals.create(author, opportunity.publicId, {
    opportunityVersion: assignment.version,
    validUntil: new Date(Date.now() + 86400000 * 30).toISOString(),
    terms:
      "Synthetic scope and commercial terms; no actual customer commitment.",
    lines: [
      { packageId: pack.publicId, quantity: 2, unitPrice: 100.1, taxRate: 18 },
    ],
  });
  assert.equal(created.revision, 1);
  await assert.rejects(
    proposals.decide(author, opportunity.publicId, created.id, {
      version: 1,
      status: "APPROVED",
      evidence: "This author must not approve their own proposal.",
    }),
    /different/,
  );
  await proposals.decide(approver, opportunity.publicId, created.id, {
    version: 1,
    status: "APPROVED",
    evidence: "Synthetic independent review of scope and quoted rates.",
  });
  await assert.rejects(
    proposals.decide(author, opportunity.publicId, created.id, {
      version: 1,
      status: "SENT",
      evidence: "Stale send must not replace an approved revision.",
    }),
    /changed/,
  );
  await proposals.decide(author, opportunity.publicId, created.id, {
    version: 2,
    status: "SENT",
    evidence: "Synthetic recorded delivery reference TEST-SEND-001.",
  });
  await proposals.decide(author, opportunity.publicId, created.id, {
    version: 3,
    status: "ACCEPTED",
    evidence: "Synthetic acceptance reference TEST-ACCEPT-001.",
  });
  const download = await proposals.forDownload(
    author,
    opportunity.publicId,
    created.id,
  );
  assert.equal(download.status, "ACCEPTED");
  assert.equal(download.snapshot.totalPaise, "23624");
  assert.ok((await proposalPdf(download)).length > 1000);
  assert.equal(
    (
      await tx.salesOpportunity.findUniqueOrThrow({
        where: { id: opportunity.id },
      })
    ).stage,
    "QUALIFIED",
  );
  await assert.rejects(
    proposals.list({ ...author, tenantId: -1n }, opportunity.publicId),
    /not found/,
  );
  const sequence = new CrmSequenceController(db);
  const current = await sequence.get(author, opportunity.publicId);
  const started = await sequence.set(author, opportunity.publicId, {
    version: current.version,
    enabled: true,
  });
  assert.equal(started.followUpSequenceStep, 0);
  const followUp = new CrmFollowUpService(db);
  for (let step = 0; step < 3; step++) {
    const row = await sequence.get(author, opportunity.publicId);
    await followUp.complete(author, opportunity.publicId, {
      version: row.version,
      notes: `Synthetic sequence contact ${step + 1}`,
    });
  }
  const done = await sequence.get(author, opportunity.publicId);
  assert.equal(done.followUpSequenceStep, 3);
  assert.equal(done.nextFollowUpAt, null);
  assert.equal(
    await tx.outboxEvent.count({ where: { tenantId: f.tenant.id } }),
    0,
  );
}
