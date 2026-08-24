import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { UploadedBinary } from "../src/common/http/uploaded-binary";
import { ContentInspectionService } from "../src/documents/content-inspection.service";

function file(buffer: Buffer, mimetype: string): UploadedBinary {
  return {
    buffer,
    mimetype,
    size: buffer.length,
    originalName: "evidence.bin",
  };
}

void test("content inspection accepts real PDF signature", async () => {
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
