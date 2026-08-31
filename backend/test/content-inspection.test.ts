import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { UploadedBinary } from "../src/common/http/uploaded-binary";
import { ContentInspectionService } from "../src/documents/content-inspection.service";
import { PDFDocument } from "pdf-lib";

function file(
  buffer: Buffer,
  mimetype: string,
  originalName = "evidence.bin",
): UploadedBinary {
  return {
    buffer,
    mimetype,
    size: buffer.length,
    originalName,
  };
}

void test("basic evidence inspection accepts a matching PDF signature", async () => {
  const service = new ContentInspectionService(
    new ConfigService({ MALWARE_SCAN_REQUIRED: false }),
  );
  await assert.doesNotReject(() =>
    service.inspect(
      file(Buffer.from("%PDF-1.7 sample"), "application/pdf"),
      1024,
    ),
  );
});

void test("document inspection parses a structurally valid PDF", async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  page.drawText("Utility account statement with address and billing details");
  const buffer = Buffer.from(await pdf.save({ useObjectStreams: false }));
  const service = new ContentInspectionService(
    new ConfigService({ MALWARE_SCAN_REQUIRED: false }),
  );
  await assert.doesNotReject(() =>
    service.inspect(file(buffer, "application/pdf", "address.pdf"), 100_000, {
      documentType: "ADDRESS_PROOF",
    }),
  );
});

void test("document inspection rejects a signature-only fake PDF", async () => {
  const service = new ContentInspectionService(
    new ConfigService({ MALWARE_SCAN_REQUIRED: false }),
  );
  await assert.rejects(
    () =>
      service.inspect(
        file(Buffer.from("%PDF-1.7 sample"), "application/pdf", "identity.pdf"),
        100_000,
        { documentType: "AADHAAR" },
      ),
    BadRequestException,
  );
});

void test("photo identity PDF must contain a usable embedded image", async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  page.drawText("Text alone is not accepted as a photo identity document");
  const buffer = Buffer.from(await pdf.save({ useObjectStreams: false }));
  const service = new ContentInspectionService(
    new ConfigService({ MALWARE_SCAN_REQUIRED: false }),
  );
  await assert.rejects(
    () =>
      service.inspect(file(buffer, "application/pdf", "aadhaar.pdf"), 100_000, {
        documentType: "AADHAAR",
      }),
    BadRequestException,
  );
});

void test("content inspection rejects extension or MIME spoofing", async () => {
  const service = new ContentInspectionService(
    new ConfigService({ MALWARE_SCAN_REQUIRED: false }),
  );
  await assert.rejects(
    () =>
      service.inspect(file(Buffer.from("not a pdf"), "application/pdf"), 1024),
    BadRequestException,
  );
});
