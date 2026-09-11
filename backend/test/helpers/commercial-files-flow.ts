import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "../../src/generated/prisma/client";
import type { PrismaService } from "../../src/database/prisma.service";
import { ClientAgreementFilesService } from "../../src/clients/client-agreement-files.service";
import { ContentInspectionService } from "../../src/documents/content-inspection.service";
import type { LocalObjectStorageService } from "../../src/documents/local-object-storage.service";
import { assertClientActivation } from "../../src/clients/client-activation.policy";
import { proofFile } from "./intake-source-fixture";
import type { CommercialFixture } from "./rollback-database";

export async function commercialFilesFlow(
  tx: Prisma.TransactionClient,
  db: PrismaService,
  f: CommercialFixture,
) {
  const author = { ...f.manager, roles: ["SALES_MANAGER"] };
  const reviewer = { ...f.finance, roles: ["PLATFORM_ADMIN"] };
  const objects = new Map<string, Buffer>();
  const storage = {
    put: (key: string, bytes: Buffer) => {
      objects.set(key, bytes);
      return Promise.resolve();
    },
    delete: (key: string) => {
      objects.delete(key);
      return Promise.resolve();
    },
    auditedStream: async (key: string, audit: () => Promise<unknown>) => {
      assert.ok(objects.has(key));
      await audit();
      return Readable.from(objects.get(key)!);
    },
  } as unknown as LocalObjectStorageService;
  const service = new ClientAgreementFilesService(
    db,
    new ContentInspectionService(
      new ConfigService({ MALWARE_SCAN_REQUIRED: false, CLAMAV_HOST: "" }),
    ),
    storage,
  );
  await tx.client.update({
    where: { id: f.client.id },
    data: { billingAddress: "Synthetic office", billingTerms: "15 days" },
  });
  await tx.clientPackageRate.create({
    data: {
      clientId: f.client.id,
      servicePackageId: f.row.servicePackageId!,
      unitPrice: 100,
    },
  });
  let last: { agreementId: string; fileId: string } | undefined;
  for (const type of ["AGREEMENT", "DPA"]) {
    const agreement = await tx.clientAgreement.create({
      data: {
        clientId: f.client.id,
        type,
        reference: `TEST-${type}`,
        signedAt: new Date(Date.now() - 86400000),
      },
    });
    const file = await proofFile(type);
    const uploaded = await service.upload(
      author,
      f.client.publicId,
      agreement.publicId,
      file,
    );
    assert.equal(uploaded.revision, 1);
    await assert.rejects(
      service.upload(author, f.client.publicId, agreement.publicId, file),
      /exact file/,
    );
    assert.equal(objects.size, type === "AGREEMENT" ? 1 : 2);
    const review = {
      version: 1,
      status: "APPROVED",
      notes:
        "Synthetic original and signature review by independent colleague.",
      signaturesChecked: true,
    };
    await assert.rejects(
      service.review(
        author,
        f.client.publicId,
        agreement.publicId,
        uploaded.id,
        review,
      ),
      /different/,
    );
    await service.review(
      reviewer,
      f.client.publicId,
      agreement.publicId,
      uploaded.id,
      review,
    );
    const listed = await service.list(
      reviewer,
      f.client.publicId,
      agreement.publicId,
    );
    assert.equal(listed.items[0]?.status, "APPROVED");
    assert.equal(listed.items[0]?.isUploader, false);
    const downloaded = await service.download(
      reviewer,
      f.client.publicId,
      agreement.publicId,
      uploaded.id,
    );
    assert.equal(downloaded.getHeaders().type, "application/pdf");
    await assert.rejects(
      service.list(
        { ...reviewer, tenantId: -1n },
        f.client.publicId,
        agreement.publicId,
      ),
      /not found/,
    );
    last = { agreementId: agreement.publicId, fileId: uploaded.id };
  }
  const onboarding = () =>
    tx.client.findUniqueOrThrow({
      where: { id: f.client.id },
      include: {
        packageRates: true,
        agreements: {
          include: { files: { orderBy: { revision: "desc" }, take: 1 } },
        },
      },
    });
  assertClientActivation(await onboarding());
  const replacement = await service.upload(
    author,
    f.client.publicId,
    last!.agreementId,
    await proofFile("replacement"),
  );
  assert.equal(replacement.revision, 2);
  const row = await onboarding();
  assert.throws(
    () => assertClientActivation(row),
    /independently approved file/,
  );
  await assert.rejects(
    service.review(
      reviewer,
      f.client.publicId,
      last!.agreementId,
      last!.fileId,
      {
        version: 2,
        status: "APPROVED",
        notes: "Old revision must not be reviewed again.",
        signaturesChecked: true,
      },
    ),
    /latest/,
  );
  assert.equal(
    await tx.clientAgreementFile.count({
      where: { agreement: { clientId: f.client.id } },
    }),
    3,
  );
}
