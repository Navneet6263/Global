import "reflect-metadata";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { CandidateSupportService } from "../src/candidate-portal/candidate-support.service";
import type { PrismaService } from "../src/database/prisma.service";
import { assertSupportTransition } from "../src/support/services/support-rules";
import {
  clientAdmin,
  request,
  supportHarness,
} from "./helpers/support-fixtures";
import { bigJson } from "./helpers/test-actor";

void test("a candidate request takes its client and case from the verified link token", async () => {
  const token = "portal-token";
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
      clientId: 21n,
      subject: { fullName: "Vivo" },
      client: { displayName: "Client A" },
      clarifications: [],
    },
  };
  const { create, calls } = supportHarness();
  const portal = new CandidateSupportService(
    {
      candidatePortalAccess: { findUnique: () => Promise.resolve(access) },
    } as unknown as PrismaService,
    create,
  );
  const created = await portal.raise("access-1", token, request);
  assert.equal(created.requestNumber, "SR-20260929-ABC123");
  const data = calls.create![0]!.data!;
  assert.equal(data.requesterType, "CANDIDATE");
  assert.equal(data.clientId, 21n);
  assert.equal(data.caseId, 81n);
  assert.equal(data.requesterUserId, null);
  assert.equal(data.status, undefined, "starts at the OPEN column default");
  assert.deepEqual(calls.open![0]!.where, {
    tenantId: 7n,
    requesterType: "CANDIDATE",
    status: { not: "RESOLVED" },
    caseId: 81n,
  });
  const notices = calls.notifyAgents![0]!.data as unknown as Array<
    Record<string, unknown>
  >;
  assert.equal(notices.length, 2);
  assert.equal(notices[0]!.type, "SUPPORT_REQUEST_CREATED");
  assert.match(String(notices[0]!.body), /candidate Vivo \(Client A\)/);
  assert.match(
    bigJson(calls.agents![0]!.where),
    /"status":"ACTIVE".*"code":"SUPPORT_AGENT"/,
  );
  assert.equal(calls.audit![0]!.data!.action, "support_request.created");

  await assert.rejects(
    portal.raise("access-1", "wrong-token", request),
    UnauthorizedException,
  );
});

void test("request limits, blank text and resolved requests are refused", async () => {
  const full = supportHarness({ open: 5 });
  await assert.rejects(
    full.create.forCandidate(
      {
        tenantId: 7n,
        caseId: 81n,
        clientId: 21n,
        clientName: "A",
        candidateName: "Vivo",
      },
      request,
    ),
    ConflictException,
  );
  assert.equal(full.calls.create, undefined);
  const blank = supportHarness();
  await assert.rejects(
    blank.create.forClientAdmin(clientAdmin, {
      subject: "  ",
      message: "hello there",
    }),
    BadRequestException,
  );
  assert.throws(
    () => assertSupportTransition("RESOLVED", "IN_PROGRESS"),
    ConflictException,
  );
  assert.throws(
    () => assertSupportTransition("IN_PROGRESS", "IN_PROGRESS"),
    ConflictException,
  );
  assertSupportTransition("OPEN", "RESOLVED");
});

void test("a Client Admin request uses its own client; another client's case number is refused", async () => {
  const { create, calls } = supportHarness({ linkedCase: { id: 81n } });
  await create.forClientAdmin(clientAdmin, { ...request, caseNumber: "SG-1" });
  const data = calls.create![0]!.data!;
  assert.equal(data.clientId, 21n);
  assert.equal(data.caseId, 81n);
  assert.equal(data.requesterUserId, 41n);
  assert.deepEqual(calls.client![0]!.where, { tenantId: 7n, id: 21n });
  // The case lookup goes through the Client Admin's own case scope.
  assert.equal(calls.case![0]!.where!.clientId, 21n);

  const other = supportHarness();
  await assert.rejects(
    other.create.forClientAdmin(clientAdmin, {
      ...request,
      caseNumber: "SG-9",
    }),
    NotFoundException,
  );
  assert.equal(other.calls.create, undefined);
  const unlinked = supportHarness();
  await assert.rejects(
    unlinked.create.forClientAdmin(
      { ...clientAdmin, clientId: undefined },
      request,
    ),
    ForbiddenException,
  );

  const mine = supportHarness();
  await mine.requester.forClientAdmin(clientAdmin, { page: 1, pageSize: 10 });
  assert.deepEqual(mine.calls.list![0]!.where, {
    tenantId: 7n,
    requesterType: "CLIENT_ADMIN",
    requesterUserId: 41n,
  });
  await mine.requester.forCandidate(7n, 81n);
  assert.deepEqual(mine.calls.list![1]!.where, {
    tenantId: 7n,
    caseId: 81n,
    requesterType: "CANDIDATE",
  });
});
