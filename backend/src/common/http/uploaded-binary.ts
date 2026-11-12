import { BadRequestException, ConflictException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";

export interface UploadedBinary {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
  size: number;
}

export async function readUploadedBinary(
  request: FastifyRequest,
  maxBytes: number,
): Promise<UploadedBinary> {
  let part;
  try {
    part = await request.file({
      limits: { files: 1, fileSize: maxBytes, fields: 8, parts: 9 },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("large")
    ) {
      throw new BadRequestException("File exceeds the upload limit");
    }
    throw error;
  }
  if (!part || part.fieldname !== "file") {
    throw new BadRequestException("A file field named 'file' is required");
  }
  const buffer = await part.toBuffer();
  if (part.file.truncated || buffer.length > maxBytes) {
    throw new BadRequestException("File exceeds the upload limit");
  }
  const claimedDigest = request.headers["x-content-sha256"];
  if (claimedDigest) {
    assertDigestMatches(claimedDigest, buffer);
  }
  return {
    buffer,
    mimetype: part.mimetype,
    originalName: part.filename,
    size: buffer.length,
  };
}

export interface UploadedMultipartPayload {
  file: UploadedBinary;
  fields: Record<string, string>;
}

/** Reads one binary `file` part plus string form fields in any multipart order. */
export async function readUploadedMultipart(
  request: FastifyRequest,
  maxBytes: number,
): Promise<UploadedMultipartPayload> {
  let file: UploadedBinary | null = null;
  const fields: Record<string, string> = {};
  try {
    for await (const part of request.parts({
      limits: { files: 1, fileSize: maxBytes, fields: 10, parts: 11 },
    })) {
      if (part.type === "file") {
        if (part.fieldname !== "file") {
          throw new BadRequestException("A file field named 'file' is required");
        }
        const buffer = await part.toBuffer();
        if (part.file.truncated || buffer.length > maxBytes) {
          throw new BadRequestException("File exceeds the upload limit");
        }
        const claimedDigest = request.headers["x-content-sha256"];
        if (claimedDigest) {
          assertDigestMatches(claimedDigest, buffer);
        }
        file = {
          buffer,
          mimetype: part.mimetype,
          originalName: part.filename,
          size: buffer.length,
        };
      } else if (typeof part.value === "string") {
        fields[part.fieldname] = part.value;
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("large")
    ) {
      throw new BadRequestException("File exceeds the upload limit");
    }
    throw error;
  }
  if (!file) {
    throw new BadRequestException("A file field named 'file' is required");
  }
  return { file, fields };
}

function assertDigestMatches(claimedDigest: string | string[], buffer: Buffer) {
  const value = Array.isArray(claimedDigest) ? claimedDigest[0] : claimedDigest;
  const actual = createHash("sha256").update(buffer).digest("hex");
  if (!value || !/^[a-f0-9]{64}$/.test(value) || value !== actual) {
    throw new ConflictException(
      "Uploaded file digest does not match its request header",
    );
  }
}
