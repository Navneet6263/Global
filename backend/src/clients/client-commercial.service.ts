import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { UpdateCommercialDto } from "./dto/update-commercial.dto";

export function validateCommercial(input: UpdateCommercialDto) {
  if (
    new Set(input.packages.map((row) => row.servicePackageId)).size !==
    input.packages.length
  ) {
    throw new BadRequestException("Each service package may appear only once");
  }
  for (const agreement of input.agreements) {
    if (!agreement.reference.trim())
      throw new BadRequestException("Agreement reference is required");
    if (
      agreement.signedAt &&
      agreement.expiresAt &&
      new Date(agreement.expiresAt) <= new Date(agreement.signedAt)
    ) {
      throw new BadRequestException(
        "Agreement expiry must follow its signing date",
      );
    }
  }
}

@Injectable()
export class ClientCommercialService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor, clientId: string) {
    const row = await this.prisma.client.findFirst({
      where: this.scope(actor, clientId),
      select: {
        publicId: true,
        version: true,
        gstin: true,
        billingAddress: true,
        billingTerms: true,
        packageRates: {
          select: {
            unitPrice: true,
            taxRate: true,
            tatHours: true,
            active: true,
            servicePackage: { select: { publicId: true, name: true } },
          },
        },
        agreements: {
          select: {
            publicId: true,
            type: true,
            reference: true,
            signedAt: true,
            expiresAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!row) throw new NotFoundException("Client not found");
    const catalog = await this.prisma.servicePackage.findMany({
      where: { tenantId: actor.tenantId, isActive: true },
      select: { publicId: true, name: true, price: true, tatHours: true },
      orderBy: { name: "asc" },
    });
    return {
      id: row.publicId,
      version: row.version,
      gstin: row.gstin,
      billingAddress: row.billingAddress,
      billingTerms: row.billingTerms,
      packages: row.packageRates.map((rate) => ({
        servicePackageId: rate.servicePackage.publicId,
        name: rate.servicePackage.name,
        unitPrice: Number(rate.unitPrice),
        taxRate: Number(rate.taxRate),
        tatHours: rate.tatHours,
        active: rate.active,
      })),
      agreements: row.agreements.map(({ publicId, ...agreement }) => ({
        id: publicId,
        ...agreement,
      })),
      catalog: catalog.map(({ publicId, ...item }) => ({
        id: publicId,
        ...item,
        price: item.price === null ? null : Number(item.price),
      })),
    };
  }

  async update(actor: Actor, clientId: string, input: UpdateCommercialDto) {
    validateCommercial(input);
    const client = await this.prisma.client.findFirst({
      where: this.scope(actor, clientId),
      select: { id: true, version: true },
    });
    if (!client) throw new NotFoundException("Client not found");
    if (client.version !== input.version)
      throw new ConflictException("Client changed; refresh before saving");
    const packages = await this.prisma.servicePackage.findMany({
      where: {
        tenantId: actor.tenantId,
        publicId: { in: input.packages.map((row) => row.servicePackageId) },
      },
      select: { id: true, publicId: true, isActive: true },
    });
    if (packages.length !== input.packages.length)
      throw new BadRequestException(
        "One or more packages do not belong to this workspace",
      );
    const ids = new Map(packages.map((row) => [row.publicId, row]));
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.client.updateMany({
        where: { id: client.id, version: input.version },
        data: {
          gstin: input.gstin?.trim() || null,
          billingAddress: input.billingAddress?.trim() || null,
          billingTerms: input.billingTerms?.trim() || null,
          version: { increment: 1 },
        },
      });
      if (locked.count !== 1)
        throw new ConflictException("Client changed; refresh before saving");
      for (const rate of input.packages) {
        const selected = ids.get(rate.servicePackageId)!;
        if (rate.active && !selected.isActive)
          throw new BadRequestException(
            "An inactive service package cannot be enabled",
          );
        const data = {
          unitPrice: rate.unitPrice,
          taxRate: rate.taxRate,
          tatHours: rate.tatHours ?? null,
          active: rate.active,
        };
        await tx.clientPackageRate.upsert({
          where: {
            clientId_servicePackageId: {
              clientId: client.id,
              servicePackageId: selected.id,
            },
          },
          create: {
            clientId: client.id,
            servicePackageId: selected.id,
            ...data,
          },
          update: data,
        });
      }
      for (const agreement of input.agreements) {
        await tx.clientAgreement.create({
          data: {
            clientId: client.id,
            type: agreement.type,
            reference: agreement.reference.trim(),
            signedAt: agreement.signedAt ? new Date(agreement.signedAt) : null,
            expiresAt: agreement.expiresAt
              ? new Date(agreement.expiresAt)
              : null,
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.commercial.updated",
          resourceType: "client",
          resourcePublicId: clientId,
          afterJson: JSON.stringify({
            version: input.version + 1,
            packageIds: input.packages.map((row) => row.servicePackageId),
            agreementsAdded: input.agreements.length,
          }),
        },
      });
    });
    return this.get(actor, clientId);
  }

  private scope(actor: Actor, publicId: string) {
    return {
      tenantId: actor.tenantId,
      publicId,
      ...(actor.clientId ? { id: actor.clientId } : {}),
    };
  }
}
