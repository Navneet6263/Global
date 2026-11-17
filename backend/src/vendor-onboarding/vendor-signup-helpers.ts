import { createHash, randomInt } from "node:crypto";
import type { RequestMeta } from "../auth/auth.types";
import type { Prisma, SignupRequest } from "../generated/prisma/client";

export const ACTIVE_VENDOR_TERMS_VERSION = "2026.1";
export const ACTIVE_VENDOR_PRIVACY_VERSION = "2026.1";

export const OTP_TTL_MS = 10 * 60_000;
export const RESEND_AFTER_MS = 45_000;
export const MAX_SENDS = 5;
export const MAX_ATTEMPTS = 5;
export const MAX_STARTS_PER_HOUR = 5;
export const SIGNUP_WINDOW_MS = 24 * 3_600_000;

export const otpHash = (signupId: string, otp: string) =>
  createHash("sha256").update(`${signupId}:${otp}`).digest("hex");

export const newOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export async function createVendorAccountTx(
  tx: Prisma.TransactionClient,
  row: Pick<
    SignupRequest,
    | "tenantId"
    | "email"
    | "normalizedEmail"
    | "fullName"
    | "phone"
    | "passwordHash"
    | "companyName"
    | "businessType"
  >,
  roleId: bigint,
  meta: RequestMeta,
) {
  const user = await tx.user.create({
    data: {
      tenantId: row.tenantId,
      email: row.email,
      normalizedEmail: row.normalizedEmail,
      displayName: row.fullName,
      phone: row.phone,
      passwordHash: row.passwordHash,
      mustChangePassword: false,
      vendorOwnerId: null,
      userRoles: { create: { roleId } },
    },
    select: { id: true, publicId: true },
  });

  const profile = await tx.vendorProfile.create({
    data: {
      tenantId: row.tenantId,
      vendorUserId: user.id,
      businessName: row.companyName,
      businessType: row.businessType ?? "PRIVATE_LIMITED",
      verificationStatus: "PENDING_UPLOAD",
      authorisedSignatory: true,
      termsAcceptedAt: new Date(),
      termsVersion: ACTIVE_VENDOR_TERMS_VERSION,
      privacyVersion: ACTIVE_VENDOR_PRIVACY_VERSION,
      termsAcceptedIp: meta.ipAddress?.slice(0, 64) ?? null,
    },
    select: { id: true, publicId: true },
  });

  await tx.auditEvent.createMany({
    data: [
      {
        tenantId: row.tenantId,
        actorUserId: user.id,
        action: "vendor.self-signup",
        resourceType: "vendor_profile",
        resourcePublicId: profile.publicId,
        ipAddress: meta.ipAddress,
        locationLabel: meta.locationLabel,
        afterJson: JSON.stringify({
          businessName: row.companyName,
          verificationStatus: "PENDING_UPLOAD",
          termsVersion: ACTIVE_VENDOR_TERMS_VERSION,
        }),
      },
      {
        tenantId: row.tenantId,
        actorUserId: user.id,
        action: "user.self-registered",
        resourceType: "user",
        resourcePublicId: user.publicId,
        ipAddress: meta.ipAddress,
        afterJson: JSON.stringify({
          role: "VENDOR",
          isMainVendor: true,
          emailVerified: true,
        }),
      },
    ],
  });

  return user;
}
