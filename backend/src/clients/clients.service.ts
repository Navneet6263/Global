import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { clientPublicSelect } from "../common/persistence/public-selects";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { ClientQueryDto } from "./dto/client-query.dto";
import type { CreateClientDto } from "./dto/create-client.dto";
import type { UpdateClientDto } from "./dto/update-client.dto";

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: ClientQueryDto) {
    const where = clientDirectoryWhere(actor, query);
    const orderBy: Prisma.ClientOrderByWithRelationInput[] = [
      { displayName: "asc" },
      { publicId: "asc" },
    ];
    const pageSize = query.pageSize ?? query.limit;
    if (query.page) {
      const [rows, total] = await Promise.all([
        this.prisma.client.findMany({
          where,
          select: clientPublicSelect,
          orderBy,
          skip: (query.page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.client.count({ where }),
      ]);
      return {
        items: rows,
        total,
        page: query.page,
        pageSize,
        nextCursor:
          query.page * pageSize < total
            ? (rows.at(-1)?.publicId ?? null)
            : null,
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        select: clientPublicSelect,
        orderBy,
        take: query.limit + 1,
        ...(query.cursor
          ? { cursor: { publicId: query.cursor }, skip: 1 }
          : {}),
      }),
      this.prisma.client.count({ where }),
    ]);
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items,
      total,
      nextCursor: hasMore ? (items.at(-1)?.publicId ?? null) : null,
    };
  }

  async create(actor: Actor, input: CreateClientDto) {
    const code = input.code.trim().toUpperCase();
    const exists = await this.prisma.client.findFirst({
      where: { tenantId: actor.tenantId, code },
      select: { id: true },
    });
    if (exists)
      throw new ConflictException("A client with this code already exists");

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          tenantId: actor.tenantId,
          code,
          legalName: input.legalName.trim(),
          displayName: input.displayName.trim(),
          contactName: input.contactName?.trim(),
          contactEmail: input.contactEmail?.trim().toLowerCase(),
          contactPhone: input.contactPhone,
          slaHours: input.slaHours,
        },
        select: clientPublicSelect,
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.created",
          resourceType: "client",
          resourcePublicId: client.publicId,
          afterJson: JSON.stringify(client),
        },
      });
      return client;
    });
  }

  async update(actor: Actor, publicId: string, input: UpdateClientDto) {
    const current = await this.prisma.client.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId,
        ...(actor.clientId ? { id: actor.clientId } : {}),
      },
      select: { id: true, ...clientPublicSelect },
    });
    if (!current) throw new NotFoundException("Client not found");
    if (current.version !== input.version) {
      throw new ConflictException("Client changed; refresh and try again");
    }
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.client.updateMany({
        where: {
          id: current.id,
          tenantId: actor.tenantId,
          version: input.version,
        },
        data: {
          legalName: input.legalName?.trim(),
          displayName: input.displayName?.trim(),
          contactName: input.contactName?.trim(),
          contactEmail: input.contactEmail?.trim().toLowerCase(),
          contactPhone: input.contactPhone?.trim(),
          slaHours: input.slaHours,
          status: input.status,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw new ConflictException("Client was updated concurrently");
      const updated = await tx.client.findUniqueOrThrow({
        where: { id: current.id },
        select: clientPublicSelect,
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "client.updated",
          resourceType: "client",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            displayName: current.displayName,
            status: current.status,
            slaHours: current.slaHours,
            version: current.version,
          }),
          afterJson: JSON.stringify(updated),
        },
      });
      return updated;
    });
  }
}

export function clientDirectoryWhere(
  actor: Actor,
  query: ClientQueryDto,
): Prisma.ClientWhereInput {
  const search = query.search?.trim();
  return {
    tenantId: actor.tenantId,
    ...(actor.clientId ? { id: actor.clientId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search } },
            { displayName: { contains: search } },
            { legalName: { contains: search } },
            { contactName: { contains: search } },
            { contactEmail: { contains: search } },
          ],
        }
      : {}),
  };
}
