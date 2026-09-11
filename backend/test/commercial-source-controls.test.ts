import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PDFDocument } from "pdf-lib";
import { ROLES_KEY, PERMISSIONS_KEY } from "../src/common/auth/auth.decorators";
import { SourceOutreachController } from "../src/verification/source-outreach.controller";
import { SourceOutreachDto } from "../src/verification/dto/source-outreach.dto";
import {
  outreachDates,
  sourceRequestTemplate,
} from "../src/verification/source-outreach.policy";
import { CrmProposalController } from "../src/crm/crm-proposal.controller";
import {
  assertProposalDecision,
  proposalTotals,
  validateProposal,
} from "../src/crm/crm-proposal.policy";
import { CreateProposalDto } from "../src/crm/dto/crm-proposal.dto";
import { proposalPdf } from "../src/crm/crm-proposal-pdf";
import { sequenceAfterCompletion } from "../src/crm/crm-sequence.policy";
import { groupedReportChecks } from "../src/reports/report-template-config";

const now = new Date("2026-09-09T12:00:00Z");
const future = new Date("2026-09-20T12:00:00Z");
const past = new Date("2026-09-08T12:00:00Z");

void test("outreach rejects future/backdated and invalid follow-up times", () => {
  const base = {
    occurredAt: now.toISOString(),
    notes: "Source contacted through authorised channel",
  };
  assert.equal(outreachDates(base, past, now).nextFollowUpAt, null);
  for (const occurredAt of ["2026-09-07", "2026-09-10", "invalid"])
    assert.throws(
      () => outreachDates({ ...base, occurredAt }, past, now),
      /Contact time/,
    );
  for (const nextFollowUpAt of ["2026-09-07", "2027-09-10", "invalid"])
    assert.throws(
      () => outreachDates({ ...base, nextFollowUpAt }, past, now),
      /90 days/,
    );
  assert.throws(
    () => outreachDates({ ...base, notes: "          " }, past, now),
    /actually/,
  );
});
void test("source request templates distinguish education/employment and never claim delivery", () => {
  const education = sourceRequestTemplate("EDUCATION", "SG-TEST");
  assert.match(education.body, /qualification/);
  assert.match(
    sourceRequestTemplate("EMPLOYMENT", "SG-TEST").body,
    /employment dates/,
  );
  assert.match(
    sourceRequestTemplate("REFERENCE", "SG-TEST").body,
    /direct knowledge/,
  );
  assert.equal(education.delivery, "COPY_ONLY");
  assert.match(education.subject, /SG-TEST/);
});
void test("outreach DTO rejects unsupported channels, false completion and missing version", async () => {
  const errors = await validate(
    plainToInstance(SourceOutreachDto, {
      channel: "AUTO_EMAIL",
      outcome: "CLEAR",
      notes: "hello",
      occurredAt: "tomorrow",
    }),
  );
  for (const field of ["version", "channel", "outcome", "notes", "occurredAt"])
    assert.ok(errors.some((error) => error.property === field));
});
void test("source writes are not exposed to QA/client/finance roles", () => {
  const record = Object.getOwnPropertyDescriptor(
    SourceOutreachController.prototype,
    "record",
  )!.value;
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, record), [
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "VERIFIER",
  ]);
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, record), [
    "task:write",
  ]);
});
void test("proposal totals use exact paise and round tax per line", () => {
  assert.deepEqual(
    proposalTotals([
      { quantity: 3, unitPrice: 0.1, taxRate: 18 },
      { quantity: 1, unitPrice: 0.05, taxRate: 10 },
    ]),
    { subtotalPaise: "35", taxPaise: "6", totalPaise: "41" },
  );
  assert.equal(
    proposalTotals([{ quantity: 10000, unitPrice: 1000000, taxRate: 100 }])
      .totalPaise,
    "2000000000000",
  );
});
void test("proposal validates real future validity and unique package selection", () => {
  const line = { packageId: "pack", quantity: 1, unitPrice: 200, taxRate: 0 };
  const input = {
    opportunityVersion: 1,
    validUntil: future.toISOString(),
    terms: "Explicit scope and payment terms",
    lines: [line],
  };
  assert.equal(validateProposal(input, now).getTime(), future.getTime());
  assert.throws(
    () => validateProposal({ ...input, lines: [line, line] }, now),
    /once/,
  );
  assert.throws(
    () => validateProposal({ ...input, validUntil: past.toISOString() }, now),
    /180 days/,
  );
});
void test("proposal cannot approve itself, skip approval or accept expiry", () => {
  const draft = { status: "DRAFT", createdById: 1n, validUntil: future };
  assert.throws(
    () => assertProposalDecision(draft, "APPROVED", 1n, now),
    /different/,
  );
  assert.throws(
    () => assertProposalDecision(draft, "SENT", 2n, now),
    /not available/,
  );
  assert.doesNotThrow(() => assertProposalDecision(draft, "APPROVED", 2n, now));
  assert.throws(
    () =>
      assertProposalDecision(
        { ...draft, status: "SENT", validUntil: past },
        "ACCEPTED",
        2n,
        now,
      ),
    /expired/,
  );
  assert.throws(
    () =>
      assertProposalDecision(
        { ...draft, status: "ACCEPTED" },
        "DRAFT",
        2n,
        now,
      ),
    /not available/,
  );
});
void test("proposal input enforces quantities, amounts and bounded detail lists", async () => {
  const errors = await validate(
    plainToInstance(CreateProposalDto, {
      opportunityVersion: 1,
      validUntil: future.toISOString(),
      terms: "Some commercial terms",
      lines: [
        { packageId: "invalid", quantity: 0, unitPrice: -2, taxRate: 101 },
      ],
    }),
  );
  assert.ok(
    errors.some(
      (error) => error.property === "lines" && error.children?.length,
    ),
  );
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, CrmProposalController), [
    "PLATFORM_ADMIN",
    "SALES_MANAGER",
  ]);
});
void test("sales sequence advances at absolute day 3/day 7, without hiding late work", () => {
  assert.deepEqual(sequenceAfterCompletion(null, null), {
    nextFollowUpAt: null,
  });
  assert.equal(
    sequenceAfterCompletion(now, 0).nextFollowUpAt?.toISOString(),
    "2026-09-12T12:00:00.000Z",
  );
  assert.equal(
    sequenceAfterCompletion(now, 1).nextFollowUpAt?.toISOString(),
    "2026-09-16T12:00:00.000Z",
  );
  assert.deepEqual(sequenceAfterCompletion(now, 2), {
    followUpSequenceStep: 3,
    nextFollowUpAt: null,
  });
  assert.throws(() => sequenceAfterCompletion(now, 3), /ended/);
});
void test("service report sections preserve unmatched approved checks exactly once", () => {
  const checks = ["EMPLOYMENT", "NEW_SPECIAL_CHECK", "EDUCATION"].map(
    (type) => ({
      type,
      result: "CLEAR",
      riskLevel: "LOW",
      sourceSummary: null,
      findings: [],
    }),
  );
  const groups = groupedReportChecks("HIRECHECK", checks);
  assert.equal(groups.flatMap((group) => group.items).length, 3);
  assert.equal(new Set(groups.flatMap((group) => group.items)).size, 3);
  assert.match(groups[0]!.heading, /Career/);
});
void test("proposal PDF paginates lengthy terms and keeps its own document identity", async () => {
  const pdf = await proposalPdf({
    publicId: "proposal-test",
    revision: 1,
    status: "DRAFT",
    validUntil: future,
    approvedAt: null,
    snapshot: {
      company: "Synthetic quote client",
      contact: "Quote recipient",
      preparedBy: "Author",
      preparedAt: now.toISOString(),
      currency: "INR",
      terms: "Commercial scope and specific conditions. ".repeat(150),
      lines: [
        {
          packageId: "package",
          name: "Employment scope",
          serviceFamily: "HIRECHECK",
          tatHours: 72,
          quantity: 1,
          unitPrice: 100,
          taxRate: 18,
        },
      ],
      subtotalPaise: "10000",
      taxPaise: "1800",
      totalPaise: "11800",
    },
  });
  const doc = await PDFDocument.load(pdf);
  assert.ok(doc.getPageCount() > 1);
  assert.match(doc.getTitle()!, /Proposal/);
});
