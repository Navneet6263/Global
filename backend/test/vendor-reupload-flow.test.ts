import "reflect-metadata";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { CandidatePortalService } from "../src/candidate-portal/candidate-portal.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { DocumentsService } from "../src/documents/documents.service";
import type { RequesterSupportRequestsService } from "../src/support/services/requester-support-requests.service";
import { notifyNewVersionForVendorChain } from "../src/vendor-requests/services/vendor-notify";
import {
  nextVendorAction,
  reuploadState,
} from "../src/vendor-requests/services/vendor-rules";
import {
  config,
  input,
  pii,
  secrets,
  spocAB,
} from "./helpers/reupload-fixtures";
import { bigJson } from "./helpers/test-actor";
import {
  CLIENT_A,
  DOC,
  VENDOR_2,
  vendorWriters,
  type Args,
} from "./helpers/vendor-fixtures";

void test("re-assign waits for the new file; the loop runs NONE → REQUESTED → RECEIVED", () => {
  const chain = [{ attempt: 1, status: "REJECTED", documentVersion: 1 }];
  const waiting = nextVendorAction(
    chain,
    "IN_PROGRESS",
    true,
    "REUPLOAD_REQUIRED",
  );
  assert.equal(waiting.canReassign, false);
  assert.equal(waiting.canRequestReupload, false);
  const ready = nextVendorAction(chain, "IN_PROGRESS", true, "AVAILABLE");
  assert.equal(ready.canReassign, true);
  assert.equal(ready.canRequestReupload, true);
  assert.equal(
    nextVendorAction(chain, "QA_REVIEW", true, "AVAILABLE").canRequestReupload,
    false,
  );

  assert.equal(reuploadState([], "AVAILABLE", 1), "NONE");
  assert.equal(reuploadState(chain, "AVAILABLE", 1), "NONE");
  assert.equal(reuploadState(chain, "REUPLOAD_REQUIRED", 1), "REQUESTED");
  assert.equal(reuploadState(chain, "AVAILABLE", 2), "RECEIVED");
  assert.equal(
    reuploadState(
      [...chain, { attempt: 2, status: "PENDING", documentVersion: 2 }],
      "AVAILABLE",
      2,
    ),
    "NONE",
  );
});

void test("the server refuses re-assign while the candidate re-upload is awaited", async () => {
  const previous = {
    publicId: "a1",
    attempt: 1,
    status: "REJECTED",
    version: 2,
    decisionReason: "ytrtutyu",
    vendor: { publicId: VENDOR_2, displayName: "Beta Checks" },
    case: {
      id: 81n,
      publicId: "case-1",
      caseNumber: "SG-1",
      status: "IN_PROGRESS",
      clientId: 21n,
      client: { displayName: "Client A" },
    },
    document: {
      id: 91n,
      publicId: DOC,
      type: "EDUCATION_CERTIFICATE",
      status: "REUPLOAD_REQUIRED",
      versions: [{ version: 1 }],
      vendorAssignments: [{ attempt: 1, status: "REJECTED" }],
    },
  };
  let created = false;
  const tx = {
    vendorAssignment: {
      findFirst: () => Promise.resolve(previous),
      create: () => {
        created = true;
        return Promise.resolve({});
      },
    },
  };
  const prisma = {
    $transaction: (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;
  await assert.rejects(
    vendorWriters(prisma).reassign(spocAB, "a1", {
      vendorId: VENDOR_2,
      resolutionNote: "Candidate uploaded a clear copy",
      version: 2,
    }),
    /Waiting for the candidate's re-upload/,
  );
  assert.equal(created, false);
});

void test("a new version after a rejection tells the client's SPOC-RMs it is ready to re-assign", async () => {
  const harness = (latest: unknown) => {
    const seen: { users?: Args; notes?: Array<Record<string, unknown>> } = {};
    const tx = {
      vendorAssignment: { findFirst: () => Promise.resolve(latest) },
      user: {
        findMany: (value: Args) => {
          seen.users = value;
          return Promise.resolve([{ id: 61n }, { id: 62n }]);
        },
      },
      notification: {
        createMany: (value: { data: Array<Record<string, unknown>> }) => {
          seen.notes = value.data;
          return Promise.resolve({ count: value.data.length });
        },
      },
    };
    return { tx, seen };
  };
  const rejected = {
    status: "REJECTED",
    clientId: 21n,
    assignedById: 11n,
    documentVersion: 1,
    client: { publicId: CLIENT_A },
    case: { caseNumber: "SG-1" },
    document: { type: "EDUCATION_CERTIFICATE" },
  };
  const fresh = harness(rejected);
  await notifyNewVersionForVendorChain(
    fresh.tx as unknown as Parameters<typeof notifyNewVersionForVendorChain>[0],
    { tenantId: 7n, documentId: 91n, version: 2 },
  );
  assert.equal(fresh.seen.notes?.length, 2);
  assert.equal(fresh.seen.notes?.[0]?.type, "DOCUMENT_REUPLOAD_RECEIVED");
  assert.equal(
    fresh.seen.notes?.[0]?.href,
    `/spoc-rm/vendors?clientId=${CLIENT_A}`,
  );
  assert.match(
    bigJson(fresh.seen.users?.where),
    /"spocClientScopes":\{"some":\{"clientId":"21"\}\}/,
  );

  for (const latest of [
    null,
    { ...rejected, status: "PENDING" },
    { ...rejected, status: "APPROVED" },
    { ...rejected, documentVersion: 2 },
  ]) {
    const quiet = harness(latest);
    await notifyNewVersionForVendorChain(
      quiet.tx as unknown as Parameters<
        typeof notifyNewVersionForVendorChain
      >[0],
      { tenantId: 7n, documentId: 91n, version: 2 },
    );
    assert.equal(quiet.seen.notes, undefined);
  }
});

void test("the candidate link shows Re-upload required with the SPOC message, never the vendor reason", async () => {
  const token = "candidate-token";
  const access = {
    id: 1n,
    publicId: "access-1",
    tenantId: 7n,
    caseId: 81n,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86_400_000),
    tenant: { publicId: "tenant" },
    case: {
      publicId: "case-1",
      caseNumber: "SG-20260928-600E89",
      status: "IN_PROGRESS",
      clientId: 21n,
      dueAt: null,
      subject: { fullName: "Vivo" },
      client: { displayName: "Client A" },
      checks: [],
      documents: [
        {
          type: "EDUCATION_CERTIFICATE",
          status: "REUPLOAD_REQUIRED",
          currentVersion: 1,
          reviewNote: input.message,
          expiresAt: null,
        },
      ],
      clarifications: [],
      consents: [],
      reports: [],
    },
  };
  const prisma = {
    candidatePortalAccess: {
      findUnique: () => Promise.resolve(access),
      update: () => Promise.resolve({}),
    },
    verificationCase: {
      findUnique: () =>
        Promise.resolve({
          documents: [
            {
              type: "EDUCATION_CERTIFICATE",
              status: "REUPLOAD_REQUIRED",
              currentVersion: 1,
              expiresAt: null,
              createdAt: new Date(0),
            },
          ],
        }),
    },
    caseService: { findMany: () => Promise.resolve([]) },
  } as unknown as PrismaService;
  const supportRequests = {
    forCandidate: () => Promise.resolve([]),
  } as unknown as RequesterSupportRequestsService;
  const portal = new CandidatePortalService(
    prisma,
    {} as DocumentsService,
    config,
    secrets,
    pii,
    supportRequests,
  );
  const view = await portal.get("access-1", token);
  assert.equal(view.case.documents[0]!.status, "REUPLOAD_REQUIRED");
  assert.equal(view.case.documents[0]!.reviewNote, input.message);
  assert.doesNotMatch(JSON.stringify(view), /ytrtutyu|decisionReason/);
  assert.deepEqual(view.case.supportRequests, []);
});
