import { BadRequestException, ConflictException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import {
  MIN_USER_PASSWORD_LENGTH,
  USER_PASSWORD_PATTERN,
  USER_PASSWORD_REQUIREMENTS,
} from "../auth/password-policy";
import {
  INDIAN_MOBILE_MESSAGE,
  INDIAN_MOBILE_PATTERN,
  normalizeIndianMobile,
} from "../common/validation/indian-mobile";

export const ALLOWED_DOC_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".pdf",
  ".doc",
  ".docx",
] as const;

export const ALLOWED_DOC_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/x-png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);

export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ParsedTeamMemberPayload {
  displayName: string;
  email: string;
  phone?: string;
  temporaryPassword: string;
  departmentId: string;
  permissions?: string[];
  identityFiles: UploadedBinary[];
  agreementFile: UploadedBinary;
}

export function validateDocTypeAndSize(file: UploadedBinary) {
  const ext = file.originalName.slice(file.originalName.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_DOC_EXTENSIONS.includes(ext as (typeof ALLOWED_DOC_EXTENSIONS)[number])) {
    throw new BadRequestException(
      `File "${file.originalName}" has unsupported format. Allowed: PNG, JPG, JPEG, PDF, DOC, DOCX`,
    );
  }
  if (!ALLOWED_DOC_MIMES.has(file.mimetype)) {
    throw new BadRequestException(`File "${file.originalName}" has unsupported MIME type`);
  }
  if (file.size > MAX_DOC_BYTES) {
    throw new BadRequestException(`File "${file.originalName}" exceeds the 10 MB limit`);
  }
}

export async function parseTeamMemberMultipart(
  request: FastifyRequest,
): Promise<ParsedTeamMemberPayload> {
  const fields: Record<string, string> = {};
  const identityFiles: UploadedBinary[] = [];
  let agreementFile: UploadedBinary | undefined;

  try {
    for await (const part of request.parts({
      limits: { files: 10, fileSize: MAX_DOC_BYTES, fields: 20, parts: 30 },
    })) {
      if (part.type === "file") {
        const buffer = await part.toBuffer();
        if (part.file.truncated || buffer.length > MAX_DOC_BYTES) {
          throw new BadRequestException(`File "${part.filename}" exceeds the 10 MB limit`);
        }
        const binary: UploadedBinary = {
          buffer,
          mimetype: part.mimetype,
          originalName: part.filename,
          size: buffer.length,
        };
        validateDocTypeAndSize(binary);

        if (part.fieldname.startsWith("identity")) {
          if (identityFiles.length >= 2) {
            throw new BadRequestException("Maximum 2 identity documents allowed");
          }
          identityFiles.push(binary);
        } else if (part.fieldname.startsWith("agreement")) {
          if (agreementFile) {
            throw new BadRequestException("Maximum 1 agreement document allowed");
          }
          agreementFile = binary;
        } else {
          throw new BadRequestException(`Unexpected file field: ${part.fieldname}`);
        }
      } else if (typeof part.value === "string") {
        fields[part.fieldname] = part.value;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("large")) {
      throw new BadRequestException("One of the uploaded files exceeds the 10 MB limit");
    }
    throw error;
  }

  // Mandatory identity and agreement documents validation
  if (identityFiles.length < 1) {
    throw new BadRequestException("At least 1 Identity document is mandatory");
  }
  if (!agreementFile) {
    throw new BadRequestException("Agreement document is mandatory");
  }

  // Fields validation
  const displayName = fields.displayName?.trim();
  if (!displayName || displayName.length < 2 || displayName.length > 120) {
    throw new BadRequestException("displayName must be between 2 and 120 characters");
  }

  const email = fields.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException("A valid email is required");
  }

  const departmentId = fields.departmentId?.trim();
  if (!departmentId || !/^[0-9a-f-]{36}$/i.test(departmentId)) {
    throw new BadRequestException("Valid departmentId UUID is required");
  }

  const temporaryPassword = fields.temporaryPassword?.trim();
  if (
    !temporaryPassword ||
    temporaryPassword.length < MIN_USER_PASSWORD_LENGTH ||
    !USER_PASSWORD_PATTERN.test(temporaryPassword)
  ) {
    throw new BadRequestException(`temporaryPassword ${USER_PASSWORD_REQUIREMENTS}`);
  }

  let phone: string | undefined;
  if (fields.phone?.trim()) {
    const rawNormalized = normalizeIndianMobile(fields.phone.trim());
    const normalized = typeof rawNormalized === "string" ? rawNormalized : String(rawNormalized ?? "");
    if (!INDIAN_MOBILE_PATTERN.test(normalized)) {
      throw new BadRequestException(`phone ${INDIAN_MOBILE_MESSAGE}`);
    }
    phone = normalized;
  }

  let permissions: string[] | undefined;
  if (fields.permissions) {
    try {
      const parsed = JSON.parse(fields.permissions) as unknown;
      if (Array.isArray(parsed) && parsed.every((p): p is string => typeof p === "string")) {
        permissions = parsed;
      }
    } catch {
      // Ignored if invalid json
    }
  }

  return {
    displayName,
    email,
    phone,
    temporaryPassword,
    departmentId,
    permissions,
    identityFiles,
    agreementFile,
  };
}
