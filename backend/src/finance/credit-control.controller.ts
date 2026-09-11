import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";

export class CreditControlQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @IsOptional() @IsString() @Length(1, 120) search?: string;
}
export class CreditControlDto {
  @IsInt() @Min(1) version!: number;
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999)
  creditLimit!: number | null;
  @IsBoolean() creditHold!: boolean;
  @IsString() @Length(10, 500) reason!: string;
}
export function creditBalance(totals: {
  totalAmount: Prisma.Decimal | null;
  paidAmount: Prisma.Decimal | null;
  creditedAmount: Prisma.Decimal | null;
}) {
  return new Prisma.Decimal(totals.totalAmount ?? 0)
    .minus(totals.paidAmount ?? 0)
    .minus(totals.creditedAmount ?? 0);
}

@Controller("finance/credit-control")
@RequireRoles("PLATFORM_ADMIN", "FINANCE_MANAGER")
export class CreditControlController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  @RequirePermissions(Permission.FinanceRead)
  async list(@CurrentActor() actor: Actor, @Query() query: CreditControlQuery) {
    const where = {
      tenantId: actor.tenantId,
      ...(actor.clientId ? { id: actor.clientId } : {}),
      ...(query.search?.trim()
        ? { displayName: { contains: query.search.trim() } }
        : {}),
    };
    const [total, clients] = await Promise.all([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        orderBy: [{ displayName: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * 12,
        take: 12,
        select: {
          id: true,
          publicId: true,
          displayName: true,
          creditLimit: true,
          creditHold: true,
          creditControlReason: true,
          version: true,
        },
      }),
    ]);
    const balances = clients.length
      ? await this.prisma.invoice.groupBy({
          by: ["clientId"],
          where: {
            tenantId: actor.tenantId,
            clientId: { in: clients.map((c) => c.id) },
            status: { not: "CANCELLED" },
            currency: "INR",
          },
          _sum: { totalAmount: true, paidAmount: true, creditedAmount: true },
        })
      : [];
    return {
      total,
      page: query.page,
      pageSize: 12,
      items: clients.map(({ id, publicId, ...client }) => {
        const sum = balances.find((b) => b.clientId === id)?._sum;
        const outstanding = sum ? creditBalance(sum) : new Prisma.Decimal(0);
        return {
          id: publicId,
          ...client,
          outstanding: outstanding.toFixed(2),
          overLimit:
            client.creditLimit !== null &&
            outstanding.greaterThan(client.creditLimit),
        };
      }),
    };
  }
  @Patch(":clientId")
  @RequirePermissions(Permission.FinanceWrite)
  async update(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) id: string,
    @Body() input: CreditControlDto,
  ) {
    if (input.reason.trim().length < 10)
      throw new BadRequestException(
        "Record the credit-control decision rationale",
      );
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({
        where: {
          publicId: id,
          tenantId: actor.tenantId,
          ...(actor.clientId ? { id: actor.clientId } : {}),
        },
        select: { id: true, creditLimit: true, creditHold: true },
      });
      if (!client) throw new NotFoundException("Client not found");
      const changed = await tx.client.updateMany({
        where: { id: client.id, version: input.version },
        data: {
          creditLimit: input.creditLimit,
          creditHold: input.creditHold,
          creditControlReason: input.reason.trim(),
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new ConflictException(
          "Client changed; refresh before recording credit controls",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "finance.credit-control.updated",
          resourceType: "client",
          resourcePublicId: id,
          beforeJson: JSON.stringify({
            creditLimit: client.creditLimit,
            creditHold: client.creditHold,
          }),
          afterJson: JSON.stringify({
            creditLimit: input.creditLimit,
            creditHold: input.creditHold,
            reason: input.reason.trim(),
          }),
        },
      });
      return { version: input.version + 1 };
    });
  }
}
