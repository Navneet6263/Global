import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import type { ConfigService } from "@nestjs/config";
import { DocumentsService } from "../src/documents/documents.service";
import { DocumentsController } from "../src/documents/documents.controller";
import type { PrismaService } from "../src/database/prisma.service";
import type { ContentInspectionService } from "../src/documents/content-inspection.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import type { Actor } from "../src/common/auth/actor";
import { caseAccessScope } from "../src/common/auth/access-scope";
import {
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
} from "../src/common/auth/auth.decorators";

function fixture(contentType = "application/pdf", available = true) {
  const queries: unknown[] = [];
  const events: unknown[] = [];
  const reads: string[] = [];
  const prisma = {
    documentVersion: {
      findFirst: (query: unknown) => {
        queries.push(query);
        return Promise.resolve(
          available
            ? {
                objectKey: "private/document-version-2",
                originalName: "candidate-proof.pdf",
                contentType,
                version: 2,
                document: {
                  type: "PAN",
                  case: { publicId: "case-1", caseNumber: "TEST-001" },
                },
              }
            : null,
        );
      },
    },
    auditEvent: {
      create: (event: unknown) => {
        events.push(event);
        return Promise.resolve({});
      },
    },
  } as unknown as PrismaService;
  const storage = {
    auditedStream: async (key: string, audit: () => Promise<unknown>) => {
      reads.push(key);
      await audit();
      return Readable.from(Buffer.from("isolated test bytes"));
    },
  } as unknown as LocalObjectStorageService;
  const service = new DocumentsService(
    prisma,
    {} as ConfigService,
    {} as ContentInspectionService,
    storage,
  );
  return { service, queries, events, reads };
}

const actor = {
  tenantId: 7n,
  userId: 11n,
  roles: ["OPS_MANAGER"],
  branchId: 23n,
} as Actor;

for (const type of ["application/pdf", "image/jpeg", "image/png"]) {
  void test(`preview streams ${type} inline and records a distinct access event`, async () => {
    const { service, events } = fixture(type);
    const { file } = await service.download(actor, "document-1", "preview");
    assert.equal(file.getHeaders().type, type);
    assert.equal(
      file.getHeaders().disposition,
      'inline; filename="candidate-proof.pdf"',
    );
    assert.deepEqual(events, [
      {
        data: {
          tenantId: 7n,
          actorUserId: 11n,
          action: "document.previewed",
          resourceType: "document",
          resourcePublicId: "document-1",
          afterJson: JSON.stringify({
            caseId: "case-1",
            caseNumber: "TEST-001",
            documentType: "PAN",
            version: 2,
          }),
        },
      },
    ]);
    file.getStream().destroy();
  });
}

void test("download remains an attachment with its original audit action", async () => {
  const { service, events } = fixture();
  const { file } = await service.download(actor, "document-1");
  const disposition = file.getHeaders().disposition;
  assert.equal(typeof disposition, "string");
  assert.match(String(disposition), /^attachment;/);
  assert.equal(
    (events[0] as { data: { action: string } }).data.action,
    "document.downloaded",
  );
  file.getStream().destroy();
});

void test("preview applies the same tenant, client, branch and assignment scopes as download", async () => {
  for (const scoped of [
    actor,
    { ...actor, roles: ["CLIENT_ADMIN"], clientId: 31n },
    { ...actor, roles: ["VERIFIER"] },
    { ...actor, roles: ["QA_REVIEWER"] },
  ]) {
    const { service, queries } = fixture();
    const { file } = await service.download(scoped, "document-1", "preview");
    const query = queries[0] as { where: unknown; orderBy: unknown };
    assert.deepEqual(query.where, {
      document: {
        publicId: "document-1",
        tenantId: 7n,
        case: caseAccessScope(scoped),
      },
      malwareState: "CLEAN",
    });
    assert.deepEqual(query.orderBy, { version: "desc" });
    file.getStream().destroy();
  }
});

void test("missing, unauthorised or unsafe evidence is not read or audited as a preview", async () => {
  const { service, reads, events } = fixture("application/pdf", false);
  await assert.rejects(
    service.download(actor, "document-1", "preview"),
    /safe document version/,
  );
  assert.deepEqual(reads, []);
  assert.deepEqual(events, []);
});

void test("active or unsupported content cannot be served inline", async () => {
  for (const type of [
    "text/html",
    "image/svg+xml",
    "application/octet-stream",
  ]) {
    const { service, reads, events } = fixture(type);
    await assert.rejects(
      service.download(actor, "document-1", "preview"),
      /PDF, JPEG and PNG/,
    );
    assert.deepEqual(reads, []);
    assert.deepEqual(events, []);
  }
});

void test("preview route keeps download role/permission guards and private no-store caching", () => {
  // Reflection reads metadata from the original functions; neither is invoked here.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const preview = DocumentsController.prototype.preview;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const download = DocumentsController.prototype.download;
  assert.deepEqual(
    Reflect.getMetadata(ROLES_KEY, preview),
    Reflect.getMetadata(ROLES_KEY, download),
  );
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, preview), [
    "document:read",
  ]);
  assert.notEqual(Reflect.getMetadata(IS_PUBLIC_KEY, preview), true);
  assert.ok(
    (
      Reflect.getMetadata("__headers__", preview) as {
        name: string;
        value: string;
      }[]
    ).some(
      (header) =>
        header.name === "Cache-Control" && header.value === "private, no-store",
    ),
  );
});
