import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type {
  CreatePackageDto,
  SetDiscountDto,
  UpdatePackageDto,
} from "./dto/packages.dto";
import { discountedPrice } from "./package-discount";
import { parseCheckPrices } from "./package-pricing";

/** Keeps only valid, non-negative prices for checks that are in the package. */
function checkPriceMap(
  prices: Record<string, unknown> | undefined,
  checks: readonly string[],
) {
  const out: Record<string, number> = {};
  for (const check of checks) {
    const value = Number(prices?.[check]);
    if (
      prices?.[check] !== undefined &&
      prices[check] !== "" &&
      Number.isFinite(value) &&
      value >= 0
    )
      out[check] = Math.round(value * 100) / 100;
  }
  return out;
}

const PACKAGE_SELECT = {
  id: true,
  publicId: true,
  code: true,
  name: true,
  serviceFamily: true,
  checksJson: true,
  requiredDocumentsJson: true,
  price: true,
  tatHours: true,
  maxRmDiscountPercent: true,
  checkPricesJson: true,
  taxRate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PackageRow = {
  publicId: string;
  code: string;
  name: string;
  serviceFamily: string;
  checksJson: string;
  requiredDocumentsJson: string;
  price: { toString(): string } | null;
  tatHours: number;
  maxRmDiscountPercent: { toString(): string };
  checkPricesJson: string;
  taxRate: { toString(): string };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function list(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function present(row: PackageRow) {
  return {
    id: row.publicId,
    code: row.code,
    name: row.name,
    serviceFamily: row.serviceFamily,
    checks: list(row.checksJson),
    requiredDocuments: list(row.requiredDocumentsJson),
    price: row.price === null ? null : Number(row.price.toString()),
    tatHours: row.tatHours,
    maxRmDiscountPercent: Number(row.maxRmDiscountPercent.toString()),
    checkPrices: parseCheckPrices(row.checkPricesJson),
    taxRate: Number(row.taxRate.toString()),
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Operations Managers and Platform Admins set any discount; an RM up to the package limit. */
export function canSetAnyDiscount(actor: Actor) {
  return (
    actor.roles.includes("OPS_MANAGER") ||
    actor.roles.includes("PLATFORM_ADMIN")
  );
}

/**
 * Packages are built by Operations (or the Platform Admin), who also decide how much an
 * RM may discount each one. RMs then give their own clients a discount within that
 * limit. Every change is audited.
 */
@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor) {
    const rows = await this.prisma.servicePackage.findMany({
      where: { tenantId: actor.tenantId },
      select: PACKAGE_SELECT,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return { items: rows.map(present) };
  }

  async create(actor: Actor, input: CreatePackageDto) {
    const code = input.code.trim().toUpperCase();
    const exists = await this.prisma.servicePackage.findFirst({
      where: { tenantId: actor.tenantId, code },
      select: { id: true },
    });
    if (exists)
      throw new ConflictException("A package with this code already exists");
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.servicePackage.create({
        data: {
          tenantId: actor.tenantId,
          code,
          name: input.name.trim(),
          checksJson: JSON.stringify(input.checks),
          serviceFamily: input.serviceFamily,
          requiredDocumentsJson: JSON.stringify(input.requiredDocuments),
          price: input.price,
          tatHours: input.tatHours,
          maxRmDiscountPercent: input.maxRmDiscountPercent ?? 0,
          checkPricesJson: JSON.stringify(
            checkPriceMap(input.checkPrices, input.checks),
          ),
          ...(input.taxRate !== undefined ? { taxRate: input.taxRate } : {}),
        },
        select: PACKAGE_SELECT,
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "package.created",
          resourceType: "service-package",
          resourcePublicId: row.publicId,
          afterJson: JSON.stringify({
            code,
            name: row.name,
            price: input.price ?? null,
            tatHours: input.tatHours,
            maxRmDiscountPercent: input.maxRmDiscountPercent ?? 0,
            checkPrices: checkPriceMap(input.checkPrices, input.checks),
            taxRate: input.taxRate ?? 18,
            checks: input.checks,
          }),
        },
      });
      return present(row);
    });
  }

  async update(actor: Actor, publicId: string, input: UpdatePackageDto) {
    const current = await this.prisma.servicePackage.findFirst({
      where: { tenantId: actor.tenantId, publicId },
      select: PACKAGE_SELECT,
    });
    if (!current) throw new NotFoundException("Package not found");
    if (
      current.updatedAt.toISOString() !==
      new Date(input.updatedAt).toISOString()
    )
      throw new ConflictException("Package changed; refresh and try again");
    const data = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.checks ? { checksJson: JSON.stringify(input.checks) } : {}),
      ...(input.requiredDocuments
        ? { requiredDocumentsJson: JSON.stringify(input.requiredDocuments) }
        : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.tatHours !== undefined ? { tatHours: input.tatHours } : {}),
      ...(input.maxRmDiscountPercent !== undefined
        ? { maxRmDiscountPercent: input.maxRmDiscountPercent }
        : {}),
      ...(input.checkPrices
        ? {
            checkPricesJson: JSON.stringify(
              checkPriceMap(
                input.checkPrices,
                input.checks ?? list(current.checksJson),
              ),
            ),
          }
        : {}),
      ...(input.taxRate !== undefined ? { taxRate: input.taxRate } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.servicePackage.updateMany({
        where: { id: current.id, updatedAt: current.updatedAt },
        data,
      });
      if (changed.count !== 1)
        throw new ConflictException("Package changed; refresh and try again");
      const row = await tx.servicePackage.findUniqueOrThrow({
        where: { id: current.id },
        select: PACKAGE_SELECT,
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "package.updated",
          resourceType: "service-package",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify(present(current)),
          afterJson: JSON.stringify(present(row)),
        },
      });
      return present(row);
    });
  }

  /** Clients this person may price: every client for Ops / Admin, its own for an RM. */
  async pricingClients(actor: Actor) {
    const rows = await this.prisma.client.findMany({
      where: {
        tenantId: actor.tenantId,
        status: { in: ["ACTIVE", "ONBOARDING"] },
        ...(canSetAnyDiscount(actor)
          ? {}
          : {
              OR: [
                { primaryRmUserId: actor.userId },
                {
                  id: {
                    in: (actor.spocClients ?? []).map((client) => client.id),
                  },
                },
              ],
            }),
      },
      select: { publicId: true, displayName: true, status: true },
      orderBy: { displayName: "asc" },
      take: 500,
    });
    return {
      items: rows.map((row) => ({
        id: row.publicId,
        name: row.displayName,
        status: row.status,
      })),
    };
  }

  /** The packages one client can use, with list price, RM limit and current discount. */
  async clientPricing(actor: Actor, clientPublicId: string) {
    const client = await this.client(actor, clientPublicId);
    const [rates, discounts, packages] = await Promise.all([
      this.prisma.clientPackageRate.findMany({
        where: { clientId: client.id },
        select: { servicePackageId: true, unitPrice: true, active: true },
      }),
      this.prisma.clientPackageDiscount.findMany({
        where: { clientId: client.id },
        select: {
          servicePackageId: true,
          discountPercent: true,
          note: true,
          setById: true,
          updatedAt: true,
        },
      }),
      this.prisma.servicePackage.findMany({
        where: { tenantId: actor.tenantId, isActive: true },
        select: PACKAGE_SELECT,
        orderBy: { name: "asc" },
      }),
    ]);
    // A client with an agreement uses only its agreed packages; otherwise every active one.
    const usable = rates.length
      ? packages.filter((pkg) =>
          rates.some((rate) => rate.servicePackageId === pkg.id && rate.active),
        )
      : packages;
    const setters = await this.prisma.user.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: [...new Set(discounts.map((row) => row.setById))] },
      },
      select: { id: true, displayName: true },
    });
    const anyLimit = canSetAnyDiscount(actor);
    return {
      client: { id: client.publicId, name: client.displayName },
      canSetAnyDiscount: anyLimit,
      items: usable.map((pkg) => {
        const rate = rates.find((row) => row.servicePackageId === pkg.id);
        const discount = discounts.find(
          (row) => row.servicePackageId === pkg.id,
        );
        const listPrice = Number(
          (rate?.unitPrice ?? pkg.price ?? 0).toString(),
        );
        const percent = discount ? Number(discount.discountPercent) : 0;
        return {
          packageId: pkg.publicId,
          code: pkg.code,
          name: pkg.name,
          listPrice,
          maxRmDiscountPercent: Number(pkg.maxRmDiscountPercent),
          yourLimitPercent: anyLimit ? 100 : Number(pkg.maxRmDiscountPercent),
          discountPercent: percent,
          finalPrice: discountedPrice(listPrice, percent),
          note: discount?.note ?? null,
          setBy: discount
            ? (setters.find((user) => user.id === discount.setById)
                ?.displayName ?? null)
            : null,
          updatedAt: discount?.updatedAt ?? null,
        };
      }),
    };
  }

  async setDiscount(
    actor: Actor,
    clientPublicId: string,
    packagePublicId: string,
    input: SetDiscountDto,
  ) {
    const client = await this.client(actor, clientPublicId);
    const pkg = await this.prisma.servicePackage.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: packagePublicId,
        isActive: true,
      },
      select: { id: true, name: true, maxRmDiscountPercent: true },
    });
    if (!pkg) throw new NotFoundException("Active package not found");
    const limit = canSetAnyDiscount(actor)
      ? 100
      : Number(pkg.maxRmDiscountPercent);
    if (input.discountPercent > limit)
      throw new ForbiddenException(
        limit > 0
          ? `You can give up to ${limit}% on ${pkg.name}. Ask Operations for more.`
          : `Discounts on ${pkg.name} need Operations. Ask them to set an RM limit.`,
      );
    const note = input.note?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      const key = {
        clientId_servicePackageId: {
          clientId: client.id,
          servicePackageId: pkg.id,
        },
      };
      const before = await tx.clientPackageDiscount.findUnique({
        where: key,
        select: { discountPercent: true },
      });
      if (input.discountPercent === 0) {
        if (before) await tx.clientPackageDiscount.delete({ where: key });
      } else {
        await tx.clientPackageDiscount.upsert({
          where: key,
          create: {
            clientId: client.id,
            servicePackageId: pkg.id,
            discountPercent: input.discountPercent,
            note,
            setById: actor.userId,
          },
          update: {
            discountPercent: input.discountPercent,
            note,
            setById: actor.userId,
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client-pricing.discount-set",
          resourceType: "client",
          resourcePublicId: client.publicId,
          beforeJson: JSON.stringify({
            packageId: packagePublicId,
            discountPercent: before ? Number(before.discountPercent) : 0,
          }),
          afterJson: JSON.stringify({
            packageId: packagePublicId,
            discountPercent: input.discountPercent,
            limitPercent: limit,
            note,
          }),
        },
      });
      return {
        packageId: packagePublicId,
        discountPercent: input.discountPercent,
      };
    });
  }

  /** Ops / Admin: any client in the tenant. RM: only clients it looks after. */
  private async client(actor: Actor, publicId: string) {
    const client = await this.prisma.client.findFirst({
      where: { tenantId: actor.tenantId, publicId },
      select: {
        id: true,
        publicId: true,
        displayName: true,
        primaryRmUserId: true,
      },
    });
    if (!client) throw new NotFoundException("Client not found");
    if (canSetAnyDiscount(actor)) return client;
    const own =
      client.primaryRmUserId === actor.userId ||
      (actor.spocClients ?? []).some((row) => row.id === client.id);
    if (!own) throw new NotFoundException("Client not found");
    return client;
  }
}
