import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { VENDOR_CHECK_DOCUMENTS } from "./vendor-check-rules";

/** Check types that can go to vendors (the open queue shows a payment for each). */
export const VENDOR_RATE_TYPES = Object.keys(VENDOR_CHECK_DOCUMENTS);

/**
 * What a vendor is paid for each check type in the open queue. Operations sets it; the
 * sender can still change the payment of one check. Versioned and audited.
 */
@Injectable()
export class VendorRatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor) {
    const rows = await this.prisma.vendorRate.findMany({
      where: { tenantId: actor.tenantId },
      select: {
        checkType: true,
        price: true,
        version: true,
        updatedAt: true,
        updatedBy: { select: { displayName: true } },
      },
    });
    const byType = new Map(rows.map((row) => [row.checkType, row]));
    return {
      items: VENDOR_RATE_TYPES.map((checkType) => {
        const row = byType.get(checkType);
        return {
          checkType,
          price: row ? Number(row.price) : null,
          version: row?.version ?? 0,
          updatedAt: row?.updatedAt ?? null,
          updatedBy: row?.updatedBy?.displayName ?? null,
        };
      }),
    };
  }

  async set(
    actor: Actor,
    checkType: string,
    input: { price: number; version: number },
  ) {
    const type = checkType.trim().toUpperCase();
    if (!VENDOR_RATE_TYPES.includes(type))
      throw new BadRequestException("Unknown check type");
    const price = Math.round(Number(input.price) * 100) / 100;
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000)
      throw new BadRequestException(
        "Enter a payment between ₹0 and ₹10,00,000",
      );
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.vendorRate.findUnique({
        where: {
          tenantId_checkType: { tenantId: actor.tenantId, checkType: type },
        },
        select: { id: true, price: true, version: true },
      });
      if ((current?.version ?? 0) !== input.version)
        throw new ConflictException(
          "The rate changed meanwhile; refresh and try again",
        );
      const saved = current
        ? await tx.vendorRate.update({
            where: { id: current.id },
            data: {
              price,
              updatedById: actor.userId,
              version: { increment: 1 },
            },
            select: { price: true, version: true, updatedAt: true },
          })
        : await tx.vendorRate.create({
            data: {
              tenantId: actor.tenantId,
              checkType: type,
              price,
              updatedById: actor.userId,
            },
            select: { price: true, version: true, updatedAt: true },
          });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "vendor_rate.updated",
          resourceType: "vendor_rate",
          resourcePublicId: type,
          beforeJson: JSON.stringify({
            price: current ? Number(current.price) : null,
          }),
          afterJson: JSON.stringify({ price }),
        },
      });
      return {
        checkType: type,
        price: Number(saved.price),
        version: saved.version,
        updatedAt: saved.updatedAt,
      };
    });
  }
}
