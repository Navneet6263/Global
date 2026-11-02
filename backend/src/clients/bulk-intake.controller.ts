import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { CasesService } from "../cases/cases.service";
import { CaseCatalogQueryDto } from "../cases/dto/case-catalog-query.dto";
import { CreateCaseDto } from "../cases/dto/create-case.dto";
import { PrismaService } from "../database/prisma.service";

/**
 * Bulk initiation for internal teams. An RM works only its mapped clients; Operations,
 * Platform Admin and Data Entry may start cases for any active client. Each row is one
 * normal case creation, so its checks, consent request and audit event are unchanged.
 */
@Controller("bulk-intake")
@RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM", "DATA_ENTRY")
@RequirePermissions(Permission.CaseRead)
export class BulkIntakeController {
  constructor(
    private readonly cases: CasesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("clients")
  async clients(@CurrentActor() actor: Actor) {
    const rows = await this.prisma.client.findMany({
      where: {
        tenantId: actor.tenantId,
        status: "ACTIVE",
        ...this.clientScope(actor),
      },
      orderBy: { displayName: "asc" },
      select: { publicId: true, displayName: true },
    });
    return {
      items: rows.map((row) => ({ id: row.publicId, name: row.displayName })),
    };
  }

  @Get("catalog")
  async catalog(
    @CurrentActor() actor: Actor,
    @Query() query: CaseCatalogQueryDto,
  ) {
    if (query.clientId) await this.assertClient(actor, query.clientId);
    return this.cases.catalog(actor, query.clientId);
  }

  // One request per row keeps normal idempotency and avoids partly committed batches.
  @Post("rows")
  async create(@CurrentActor() actor: Actor, @Body() input: CreateCaseDto) {
    await this.assertClient(actor, input.clientId);
    return this.cases.create(actor, input);
  }

  /** Anyone holding a role wider than RM is not narrowed to the RM's clients. */
  private clientScope(actor: Actor) {
    const wider = actor.roles.some((role) =>
      ["PLATFORM_ADMIN", "OPS_MANAGER", "DATA_ENTRY"].includes(role),
    );
    if (wider) return {};
    const ids = (actor.spocClients ?? []).map((client) => client.id);
    return { id: { in: ids.length ? ids : [-1n] } };
  }

  private async assertClient(actor: Actor, clientPublicId: string) {
    const allowed = await this.prisma.client.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: clientPublicId,
        status: "ACTIVE",
        ...this.clientScope(actor),
      },
      select: { id: true },
    });
    if (!allowed)
      throw new ForbiddenException(
        "You can start cases only for your active clients",
      );
  }
}
