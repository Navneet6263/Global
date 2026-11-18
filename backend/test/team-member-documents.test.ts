import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_DOC_EXTENSIONS,
  ALLOWED_DOC_MIMES,
  MAX_DOC_BYTES,
  validateDocTypeAndSize,
} from "../src/workflow/team-member-documents";

test("team member document validation enforces supported formats and limits", async (t) => {
  await t.test("allows supported extensions: PNG, JPG, JPEG, PDF, DOC, DOCX", () => {
    assert.deepEqual(ALLOWED_DOC_EXTENSIONS, [
      ".png",
      ".jpg",
      ".jpeg",
      ".pdf",
      ".doc",
      ".docx",
    ]);
  });

  await t.test("allows valid MIME types for documents and images", () => {
    assert.equal(ALLOWED_DOC_MIMES.has("image/png"), true);
    assert.equal(ALLOWED_DOC_MIMES.has("image/jpeg"), true);
    assert.equal(ALLOWED_DOC_MIMES.has("image/jpg"), true);
    assert.equal(ALLOWED_DOC_MIMES.has("application/pdf"), true);
    assert.equal(ALLOWED_DOC_MIMES.has("application/msword"), true);
    assert.equal(
      ALLOWED_DOC_MIMES.has(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
      true,
    );
    assert.equal(ALLOWED_DOC_MIMES.has("application/octet-stream"), true);
    assert.equal(ALLOWED_DOC_MIMES.has("application/x-msdownload"), false);
  });

  await t.test("file size cap is strictly 10 MB", () => {
    assert.equal(MAX_DOC_BYTES, 10 * 1024 * 1024);
  });

  await t.test("validateDocTypeAndSize passes for valid PDF", () => {
    assert.doesNotThrow(() =>
      validateDocTypeAndSize({
        buffer: Buffer.from("pdf-content"),
        mimetype: "application/pdf",
        originalName: "aadhar_card.pdf",
        size: 1024,
      }),
    );
  });

  await t.test("validateDocTypeAndSize passes for valid DOCX", () => {
    assert.doesNotThrow(() =>
      validateDocTypeAndSize({
        buffer: Buffer.from("doc-content"),
        mimetype:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        originalName: "agreement.docx",
        size: 2048,
      }),
    );
  });

  await t.test("validateDocTypeAndSize passes for valid PNG image", () => {
    assert.doesNotThrow(() =>
      validateDocTypeAndSize({
        buffer: Buffer.from("png-content"),
        mimetype: "image/png",
        originalName: "pan_card.png",
        size: 5000,
      }),
    );
  });

  await t.test("validateDocTypeAndSize rejects unsupported extension", () => {
    assert.throws(
      () =>
        validateDocTypeAndSize({
          buffer: Buffer.from("bad-content"),
          mimetype: "application/pdf",
          originalName: "malicious.exe",
          size: 1024,
        }),
      /unsupported format/,
    );
  });

  await t.test("validateDocTypeAndSize rejects unsupported MIME type", () => {
    assert.throws(
      () =>
        validateDocTypeAndSize({
          buffer: Buffer.from("bad-content"),
          mimetype: "application/x-sh",
          originalName: "file.png",
          size: 1024,
        }),
      /unsupported MIME type/,
    );
  });

  await t.test("validateDocTypeAndSize rejects files exceeding 10 MB", () => {
    assert.throws(
      () =>
        validateDocTypeAndSize({
          buffer: Buffer.from("huge"),
          mimetype: "application/pdf",
          originalName: "huge.pdf",
          size: 11 * 1024 * 1024,
        }),
      /exceeds the 10 MB limit/,
    );
  });
});
