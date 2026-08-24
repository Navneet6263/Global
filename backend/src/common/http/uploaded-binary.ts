import { BadRequestException } from "@nestjs/common";
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
  return {
    buffer,
    mimetype: part.mimetype,
    originalName: part.filename,
    size: buffer.length,
  };
}
