import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { queueEmail } from "../common/mail/queue-email";
import { SecretBoxService } from "../common/security/secret-box.service";
import { PrismaService } from "../database/prisma.service";
import { AuthenticationService } from "../auth/authentication.service";
import type { RequestMeta } from "../auth/auth.types";
import { hashPassword } from "../auth/password";
import {
  USER_PASSWORD_REQUIREMENTS,
  isValidUserPassword,
} from "../auth/password-policy";
import { maskEmail } from "../auth/signup.service";
import type { VendorSignupStartDto } from "./dto/vendor-onboarding.dto";
import {
  ACTIVE_VENDOR_PRIVACY_VERSION,
  ACTIVE_VENDOR_TERMS_VERSION,
  createVendorAccountTx,
  MAX_ATTEMPTS,
  MAX_SENDS,
  MAX_STARTS_PER_HOUR,
  newOtp,
  otpHash,
  OTP_TTL_MS,
  RESEND_AFTER_MS,
  SIGNUP_WINDOW_MS,
} from "./vendor-signup-helpers";

export { ACTIVE_VENDOR_PRIVACY_VERSION, ACTIVE_VENDOR_TERMS_VERSION };

@Injectable()
export class VendorSignupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly secretBox: SecretBoxService,
    private readonly authentication: AuthenticationService,
  ) {}

  async start(input: VendorSignupStartDto, meta: RequestMeta) {
    const tenant = await this.tenant();
    const email = input.email.trim();
    const normalizedEmail = email.toLowerCase();

    if (!isValidUserPassword(input.password)) {
      throw new BadRequestException(`Password ${USER_PASSWORD_REQUIREMENTS}`);
    }

    await this.assertEmailFree(tenant.id, normalizedEmail);

    const recent = await this.prisma.signupRequest.count({
      where: {
        tenantId: tenant.id,
        normalizedEmail,
        createdAt: { gt: new Date(Date.now() - 3_600_000) },
      },
    });
    if (recent >= MAX_STARTS_PER_HOUR) {
      throw new HttpException(
        "Too many sign-up attempts for this email. Try again in an hour.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const passwordHash = await hashPassword(input.password);
    const otp = newOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const publicId = randomUUID();

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.signupRequest.updateMany({
        where: { tenantId: tenant.id, normalizedEmail, status: "PENDING" },
        data: { status: "EXPIRED" },
      });

      const created = await tx.signupRequest.create({
        data: {
          publicId,
          tenantId: tenant.id,
          signupType: "VENDOR",
          businessType: input.businessType || "PRIVATE_LIMITED",
          email,
          normalizedEmail,
          fullName: input.fullName.trim(),
          companyName: input.companyName.trim(),
          phone: input.phone?.trim() || null,
          passwordHash,
          otpHash: otpHash(publicId, otp),
          otpExpiresAt: expiresAt,
          ipAddress: meta.ipAddress?.slice(0, 64),
        },
        select: { publicId: true },
      });

      await queueEmail(tx, this.secretBox, {
        tenantId: tenant.id,
        aggregateType: "vendor_signup",
        aggregateId: created.publicId,
        to: email,
        template: "signup-otp",
        variables: {
          otp,
          name: input.fullName.trim(),
          companyName: input.companyName.trim(),
          expiresAt: expiresAt.toISOString(),
        },
      });

      return created;
    });

    return this.challenge(row.publicId, email, expiresAt);
  }

  async resend(signupId: string) {
    const row = await this.pending(signupId);
    if (row.sendCount >= MAX_SENDS) {
      throw new HttpException(
        "Too many codes sent. Start the sign-up again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const wait = row.lastSentAt.getTime() + RESEND_AFTER_MS - Date.now();
    if (wait > 0) {
      throw new HttpException(
        `Wait ${Math.ceil(wait / 1000)} seconds before requesting a new code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = newOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.signupRequest.updateMany({
        where: { id: row.id, status: "PENDING", sendCount: row.sendCount },
        data: {
          otpHash: otpHash(row.publicId, otp),
          otpExpiresAt: expiresAt,
          otpAttempts: 0,
          sendCount: { increment: 1 },
          lastSentAt: new Date(),
        },
      });
      if (!changed.count) {
        throw new ConflictException("A new code was just sent; check your inbox");
      }

      await queueEmail(tx, this.secretBox, {
        tenantId: row.tenantId,
        aggregateType: "vendor_signup",
        aggregateId: row.publicId,
        to: row.email,
        template: "signup-otp",
        variables: {
          otp,
          name: row.fullName,
          companyName: row.companyName,
          expiresAt: expiresAt.toISOString(),
        },
      });
    });

    return this.challenge(row.publicId, row.email, expiresAt);
  }

  async verify(signupId: string, otp: string, meta: RequestMeta) {
    const row = await this.pending(signupId);
    if (row.otpExpiresAt <= new Date()) {
      throw new BadRequestException("This code has expired. Request a new code.");
    }

    const expected = Buffer.from(row.otpHash, "hex");
    const actual = Buffer.from(otpHash(row.publicId, otp), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      const attempts = row.otpAttempts + 1;
      await this.prisma.signupRequest.update({
        where: { id: row.id },
        data: {
          otpAttempts: attempts,
          ...(attempts >= MAX_ATTEMPTS ? { status: "EXPIRED" } : {}),
        },
      });
      throw new BadRequestException(
        attempts >= MAX_ATTEMPTS
          ? "Too many incorrect codes. Start the sign-up again."
          : `Incorrect code. ${MAX_ATTEMPTS - attempts} attempt(s) left.`,
      );
    }

    const role = await this.prisma.role.findFirst({
      where: { tenantId: row.tenantId, code: "VENDOR" },
      select: { id: true },
    });
    if (!role) throw new ForbiddenException("Vendor role is not configured");

    const created = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.signupRequest.updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      if (!claimed.count) throw new ConflictException("This sign-up was already completed");

      if (
        await tx.user.count({
          where: { tenantId: row.tenantId, normalizedEmail: row.normalizedEmail },
        })
      ) {
        throw new ConflictException("An account with this email already exists. Sign in instead.");
      }

      return createVendorAccountTx(tx, row, role.id, meta);
    });

    return this.authentication.signInVerifiedUser(created.id, meta);
  }

  private challenge(signupId: string, email: string, expiresAt: Date) {
    return {
      signupId,
      email: maskEmail(email),
      expiresAt,
      resendAfterSeconds: RESEND_AFTER_MS / 1000,
    };
  }

  private async pending(signupId: string) {
    const row = await this.prisma.signupRequest.findFirst({
      where: {
        publicId: signupId,
        status: "PENDING",
        createdAt: { gt: new Date(Date.now() - SIGNUP_WINDOW_MS) },
      },
    });
    if (!row) {
      throw new NotFoundException("This sign-up has expired. Start again from the sign-up page.");
    }
    return row;
  }

  private async tenant() {
    const code = this.config.get<string>("SELF_SIGNUP_TENANT_CODE", "SAPLING").trim().toUpperCase();
    const row = await this.prisma.tenant.findUnique({
      where: { code },
      select: { id: true, publicId: true, name: true, status: true },
    });
    if (!row || row.status !== "ACTIVE") {
      throw new ForbiddenException("Self sign-up is not available right now");
    }
    return row;
  }

  private async assertEmailFree(tenantId: bigint, normalizedEmail: string) {
    const count = await this.prisma.user.count({ where: { tenantId, normalizedEmail } });
    if (count > 0) {
      throw new ConflictException("An account with this email already exists. Sign in instead.");
    }
  }
}
