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
import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { queueEmail } from "../common/mail/queue-email";
import { SecretBoxService } from "../common/security/secret-box.service";
import { PrismaService } from "../database/prisma.service";
import { AuthenticationService } from "./authentication.service";
import type { RequestMeta } from "./auth.types";
import type { SignupStartDto } from "./dto/signup.dto";
import { hashPassword } from "./password";
import {
  USER_PASSWORD_REQUIREMENTS,
  isValidUserPassword,
} from "./password-policy";

const OTP_TTL_MS = 10 * 60_000;
const RESEND_AFTER_MS = 45_000;
const MAX_SENDS = 5;
const MAX_ATTEMPTS = 5;
const MAX_STARTS_PER_HOUR = 5;
const SIGNUP_WINDOW_MS = 24 * 3_600_000;

const otpHash = (signupId: string, otp: string) =>
  createHash("sha256").update(`${signupId}:${otp}`).digest("hex");

const newOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
};

/** Letters of the company name plus a random suffix, e.g. ACMETE-7F3A. */
export function signupClientCode(companyName: string) {
  const letters =
    companyName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "CLIENT";
  return `${letters}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

/**
 * Public company sign-up: the person confirms the email with a 6-digit code, then a new
 * client (status ONBOARDING) and its first CLIENT_ADMIN user are created and signed in.
 * The company can complete onboarding but cannot create cases until Operations approves.
 */
@Injectable()
export class SignupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly secretBox: SecretBoxService,
    private readonly authentication: AuthenticationService,
  ) {}

  settings() {
    return {
      enabled: this.config.get<boolean>("SELF_SIGNUP_ENABLED", true),
      tenantCode: this.tenantCode(),
      passwordRequirements: USER_PASSWORD_REQUIREMENTS,
    };
  }

  async start(input: SignupStartDto, meta: RequestMeta) {
    const tenant = await this.tenant();
    const email = input.email.trim();
    const normalizedEmail = email.toLowerCase();
    if (!isValidUserPassword(input.password))
      throw new BadRequestException(`Password ${USER_PASSWORD_REQUIREMENTS}`);
    await this.assertEmailFree(tenant.id, normalizedEmail);
    const recent = await this.prisma.signupRequest.count({
      where: {
        tenantId: tenant.id,
        normalizedEmail,
        createdAt: { gt: new Date(Date.now() - 3_600_000) },
      },
    });
    if (recent >= MAX_STARTS_PER_HOUR)
      throw new HttpException(
        "Too many sign-up attempts for this email. Try again in an hour.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const passwordHash = await hashPassword(input.password);
    const otp = newOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const publicId = randomUUID();
    const row = await this.prisma.$transaction(async (tx) => {
      // Only the latest request for an email can be confirmed.
      await tx.signupRequest.updateMany({
        where: { tenantId: tenant.id, normalizedEmail, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      const created = await tx.signupRequest.create({
        data: {
          publicId,
          tenantId: tenant.id,
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
        aggregateType: "signup",
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
    if (row.sendCount >= MAX_SENDS)
      throw new HttpException(
        "Too many codes sent. Start the sign-up again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const wait = row.lastSentAt.getTime() + RESEND_AFTER_MS - Date.now();
    if (wait > 0)
      throw new HttpException(
        `Wait ${Math.ceil(wait / 1000)} seconds before requesting a new code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
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
      if (!changed.count)
        throw new ConflictException(
          "A new code was just sent; check your inbox",
        );
      await queueEmail(tx, this.secretBox, {
        tenantId: row.tenantId,
        aggregateType: "signup",
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
    if (row.otpExpiresAt <= new Date())
      throw new BadRequestException(
        "This code has expired. Request a new code.",
      );
    const expected = Buffer.from(row.otpHash, "hex");
    const actual = Buffer.from(otpHash(row.publicId, otp), "hex");
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
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
      where: { tenantId: row.tenantId, code: "CLIENT_ADMIN" },
      select: { id: true },
    });
    if (!role)
      throw new ForbiddenException("Client admin role is not configured");
    const created = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.signupRequest.updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      if (!claimed.count)
        throw new ConflictException("This sign-up was already completed");
      if (
        await tx.user.count({
          where: {
            tenantId: row.tenantId,
            normalizedEmail: row.normalizedEmail,
          },
        })
      )
        throw new ConflictException(
          "An account with this email already exists. Sign in instead.",
        );
      let code = signupClientCode(row.companyName);
      for (
        let tries = 0;
        tries < 5 &&
        (await tx.client.count({ where: { tenantId: row.tenantId, code } }));
        tries += 1
      )
        code = signupClientCode(row.companyName);
      const now = new Date();
      const client = await tx.client.create({
        data: {
          tenantId: row.tenantId,
          code,
          legalName: row.companyName,
          displayName: row.companyName,
          contactName: row.fullName,
          contactEmail: row.normalizedEmail,
          contactPhone: row.phone,
          status: "ONBOARDING",
          selfSignupAt: now,
        },
        select: { id: true, publicId: true, displayName: true },
      });
      const user = await tx.user.create({
        data: {
          tenantId: row.tenantId,
          clientId: client.id,
          email: row.email,
          normalizedEmail: row.normalizedEmail,
          displayName: row.fullName,
          phone: row.phone,
          passwordHash: row.passwordHash,
          mustChangePassword: false,
          userRoles: { create: { roleId: role.id } },
        },
        select: { id: true, publicId: true },
      });
      await tx.auditEvent.createMany({
        data: [
          {
            tenantId: row.tenantId,
            actorUserId: user.id,
            action: "client.self-signup",
            resourceType: "client",
            resourcePublicId: client.publicId,
            ipAddress: meta.ipAddress,
            locationLabel: meta.locationLabel,
            afterJson: JSON.stringify({
              code,
              company: row.companyName,
              status: "ONBOARDING",
              signupId: row.publicId,
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
              role: "CLIENT_ADMIN",
              clientId: client.publicId,
              emailVerified: true,
            }),
          },
        ],
      });
      const managers = await tx.user.findMany({
        where: {
          tenantId: row.tenantId,
          status: "ACTIVE",
          userRoles: { some: { role: { code: "OPS_MANAGER" } } },
        },
        select: { id: true },
      });
      if (managers.length)
        await tx.notification.createMany({
          data: managers.map((manager) => ({
            tenantId: row.tenantId,
            userId: manager.id,
            type: "CLIENT_SIGNED_UP",
            title: "New company signed up",
            body: `${client.displayName} registered and started onboarding. Assign an RM to help them.`,
            href: `/operations/onboarding?company=${client.publicId}`,
          })),
        });
      return user;
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
    if (!row)
      throw new NotFoundException(
        "This sign-up has expired. Start again from the sign-up page.",
      );
    return row;
  }

  private tenantCode() {
    return this.config
      .get<string>("SELF_SIGNUP_TENANT_CODE", "SAPLING")
      .trim()
      .toUpperCase();
  }

  private async tenant() {
    if (!this.config.get<boolean>("SELF_SIGNUP_ENABLED", true))
      throw new ForbiddenException("Company sign-up is not open right now");
    const tenant = await this.prisma.tenant.findFirst({
      where: { code: this.tenantCode(), status: "ACTIVE" },
      select: { id: true },
    });
    if (!tenant)
      throw new ForbiddenException("Company sign-up is not available");
    return tenant;
  }

  private async assertEmailFree(tenantId: bigint, normalizedEmail: string) {
    if (await this.prisma.user.count({ where: { tenantId, normalizedEmail } }))
      throw new ConflictException(
        "An account with this email already exists. Sign in instead.",
      );
  }
}
