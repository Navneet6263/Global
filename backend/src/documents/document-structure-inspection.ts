import { BadRequestException } from "@nestjs/common";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFStream,
} from "pdf-lib";
import type { UploadedBinary } from "../common/http/uploaded-binary";

const PHOTO_DOCUMENT_TYPES = new Set([
  "AADHAAR",
  "PAN",
  "PASSPORT",
  "DRIVING_LICENCE",
]);

const extensionsByMime: Record<string, ReadonlySet<string>> = {
  "application/pdf": new Set(["pdf"]),
  "image/jpeg": new Set(["jpg", "jpeg"]),
  "image/png": new Set(["png"]),
};

export async function inspectDocumentStructure(
  file: UploadedBinary,
  documentType: string,
): Promise<void> {
  assertFileName(file);
  if (file.mimetype === "application/pdf") {
    await inspectPdf(file.buffer, documentType);
    return;
  }
  inspectImage(file.buffer, file.mimetype);
}

function assertFileName(file: UploadedBinary) {
  const extension = file.originalName.split(".").pop()?.toLowerCase() ?? "";
  if (!extensionsByMime[file.mimetype]?.has(extension)) {
    throw new BadRequestException(
      "File extension does not match the uploaded document type",
    );
  }
}

async function inspectPdf(buffer: Buffer, documentType: string) {
  if (buffer.length < 1024) {
    throw new BadRequestException(
      "PDF is too small to contain a valid document",
    );
  }
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(buffer, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
  } catch {
    throw new BadRequestException(
      "PDF is damaged, encrypted, or cannot be read safely",
    );
  }

  const pages = pdf.getPages();
  if (pages.length === 0 || pages.length > 25) {
    throw new BadRequestException("PDF must contain between 1 and 25 pages");
  }
  assertNoActivePdfContent(pdf);

  let contentBytes = 0;
  let imageCount = 0;
  for (const page of pages) {
    const { width, height } = page.getSize();
    if (width < 72 || height < 72 || width > 4000 || height > 4000) {
      throw new BadRequestException("PDF contains an invalid page size");
    }
    contentBytes += pageContentSize(page.node.Contents());
    imageCount += pageImageCount(page.node.Resources());
  }
  if (contentBytes < 32 && imageCount === 0) {
    throw new BadRequestException(
      "PDF appears blank and has no usable content",
    );
  }
  if (PHOTO_DOCUMENT_TYPES.has(documentType) && imageCount === 0) {
    throw new BadRequestException(
      "This identity document PDF must include a visible document image/photo",
    );
  }
}

function assertNoActivePdfContent(pdf: PDFDocument) {
  const catalog = pdf.catalog;
  if (catalog.has(PDFName.of("OpenAction")) || catalog.has(PDFName.of("AA"))) {
    throw new BadRequestException(
      "PDF contains active actions and is not allowed",
    );
  }
  const names = catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  if (
    names?.has(PDFName.of("JavaScript")) ||
    names?.has(PDFName.of("EmbeddedFiles"))
  ) {
    throw new BadRequestException(
      "PDF scripts and embedded attachments are not allowed",
    );
  }
  const form = catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (form?.has(PDFName.of("XFA"))) {
    throw new BadRequestException("Dynamic XFA PDFs are not allowed");
  }
}

function pageContentSize(contents?: PDFStream | PDFArray) {
  if (!contents) return 0;
  if (contents instanceof PDFStream) return contents.getContentsSize();
  let total = 0;
  for (let index = 0; index < contents.size(); index += 1) {
    total += contents.lookupMaybe(index, PDFStream)?.getContentsSize() ?? 0;
  }
  return total;
}

function pageImageCount(resources?: PDFDict) {
  const objects = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  if (!objects) return 0;
  let count = 0;
  for (const key of objects.keys()) {
    const stream = objects.lookupMaybe(key, PDFDict, PDFStream);
    if (!(stream instanceof PDFStream)) continue;
    const subtype = stream.dict.lookupMaybe(PDFName.of("Subtype"), PDFName);
    if (subtype?.asString() !== "/Image") continue;
    const width =
      stream.dict.lookupMaybe(PDFName.of("Width"), PDFNumber)?.asNumber() ?? 0;
    const height =
      stream.dict.lookupMaybe(PDFName.of("Height"), PDFNumber)?.asNumber() ?? 0;
    if (width >= 100 && height >= 100) count += 1;
  }
  return count;
}

function inspectImage(buffer: Buffer, mime: string) {
  if (buffer.length < 10_240) {
    throw new BadRequestException(
      "Image is too small to be a readable document scan",
    );
  }
  const dimensions =
    mime === "image/png" ? pngDimensions(buffer) : jpegDimensions(buffer);
  if (!dimensions) {
    throw new BadRequestException("Image is damaged or cannot be decoded");
  }
  const { width, height } = dimensions;
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  if (shortEdge < 320 || longEdge < 480) {
    throw new BadRequestException(
      "Document image is too low-resolution; use at least 480 x 320 pixels",
    );
  }
  if (width > 12_000 || height > 12_000 || width * height > 60_000_000) {
    throw new BadRequestException("Document image dimensions are too large");
  }
}

function pngDimensions(buffer: Buffer) {
  if (buffer.length < 24 || buffer.subarray(12, 16).toString() !== "IHDR") {
    return undefined;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegDimensions(buffer: Buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === undefined) return undefined;
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
        0xcf,
      ].includes(marker)
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return undefined;
    offset += length + 2;
  }
  return undefined;
}
