import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { hashPassword } from "../auth/password";
import type { Actor } from "../common/auth/actor";
import { rmClient } from "../common/auth/rm-client";
import { SecretBoxService } from "../common/security/secret-box.service";
import { PrismaService } from "../database/prisma.service";
import {
  passwordEmailDeps,
  resetAccountPassword,
} from "../users/user-accounts";

const CLOSED = ["COMPLETED", "CLOSED", "CANCELLED"];

/**
 * One company's profile for its RM: details, numbers, the packages it can use and its
 * Client Admin logins. The RM may reset those logins' passwords (emailed, audited);
 * every other user ID stays with the Admin / Operations directory.
 */
@Injectable()
export class RmClientProfileService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly secretBox?: SecretBoxService,
  ) {}

  async profile(actor: Actor, clientPublicId: string) {
    const { id } = await rmClient(this.prisma, actor, clientPublicId);
    const now = new Date();
    const open = { clientId: id, status: { notIn: CLOSED } };
    const [company, openCases, overdueCases, completedCases, users, rates, discounts, packages] =
      await Promise.all([
        this.prisma.client.findUniqueOrThrow({
          where: { id },
          select: {
            publicId: true,
            code: true,
            legalName: true,
            displayName: true,
            status: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            gstin: true,
            billingAddress: true,
            slaHours: true,
            createdAt: true,
            selfSignupAt: true,
            primaryRmAssignedAt: true,
            primaryRm: { select: { displayName: true } },
          },
        }),
        this.prisma.verificationCase.count({ where: open }),
        this.prisma.verificationCase.count({
          where: { ...open, dueAt: { lt: now } },
        }),
        this.prisma.verificationCase.count({
          where: { clientId: id, status: { in: ["COMPLETED", "CLOSED"] } },
        }),
        this.prisma.user.findMany({
          where: {
            tenantId: actor.tenantId,
            clientId: id,
            userRoles: { some: { role: { code: "CLIENT_ADMIN" } } },
          },
          orderBy: { displayName: "asc" },
          take: 100,
          select: {
            publicId: true,
            displayName: true,
            email: true,
            phone: true,
            status: true,
            mustChangePassword: true,
            lastLoginAt: true,
            createdAt: true,
          },
        }),
        this.prisma.clientPackageRate.findMany({
          where: { clientId: id },
          select: { servicePackageId: true, active: true },
        }),
        this.prisma.clientPackageDiscount.findMany({
          where: { clientId: id },
          select: { servicePackageId: true, discountPercent: true },
        }),
        this.prisma.servicePackage.findMany({
          where: { tenantId: actor.tenantId, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, publicId: true, name: true, price: true },
        }),
      ]);
    // Same rule as case creation: an agreement limits the list, otherwise every active one.
    const usable = rates.length
      ? packages.filter((pkg) =>
          rates.some((rate) => rate.servicePackageId === pkg.id && rate.active),
        )
      : packages;
    return {
      company: {
        id: company.publicId,
        code: company.code,
        legalName: company.legalName,
        name: company.displayName,
        status: company.status,
        contactName: company.contactName,
        contactEmail: company.contactEmail,
        contactPhone: company.contactPhone,
        gstin: company.gstin,
        billingAddress: company.billingAddress,
        slaHours: company.slaHours,
        createdAt: company.createdAt,
        source: company.selfSignupAt ? "SELF_SIGNUP" : "ADDED_BY_SAPLING",
        rm: company.primaryRm
          ? { name: company.primaryRm.displayName, since: company.primaryRmAssignedAt }
          : null,
      },
      numbers: { openCases, overdueCases, completedCases },
      packages: {
        agreement: rates.length > 0,
        items: usable.map((pkg) => ({
          id: pkg.publicId,
          name: pkg.name,
          price: pkg.price === null ? null : Number(pkg.price.toString()),
          discountPercent: Number(
            discounts
              .find((row) => row.servicePackageId === pkg.id)
              ?.discountPercent.toString() ?? 0,
          ),
        })),
      },
      users: users.map(({ publicId, ...user }) => ({ id: publicId, ...user })),
    };
  }

  /** Resets a Client Admin login of one of the RM's companies; the password is emailed. */
  async resetClientAdminPassword(
    actor: Actor,
    clientPublicId: string,
    userPublicId: string,
    temporaryPassword: string,
  ) {
    const company = await rmClient(this.prisma, actor, clientPublicId);
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: userPublicId,
        clientId: company.id,
      },
      select: {
        id: true,
        status: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });
    if (!user) throw new NotFoundException("User not found in this company");
    // Only the company's own Client Admin logins, never an internal or vendor ID.
    if (
      !user.userRoles.length ||
      user.userRoles.some(({ role }) => role.code !== "CLIENT_ADMIN")
    )
      throw new ConflictException(
        "Only this company's Client Admin logins can be reset here",
      );
    if (user.status !== "ACTIVE")
      throw new ConflictException(
        "This login is suspended; ask the Admin to reactivate it first",
      );
    const passwordHash = await hashPassword(temporaryPassword);
    const { emailed } = await this.prisma.$transaction((tx) =>
      resetAccountPassword(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        userId: user.id,
        publicId: userPublicId,
        passwordHash,
        audit: { via: "RM", company: company.displayName },
        email: passwordEmailDeps(
          this.secretBox,
          this.config,
          temporaryPassword,
          "your Relationship Manager",
        ),
      }),
    );
    return { reset: true, emailed };
  }
}
