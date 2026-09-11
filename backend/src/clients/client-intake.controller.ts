import { Body, Controller, ForbiddenException, Post } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import { BadRequestException } from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { CasesService } from "../cases/cases.service";
import { CreateCaseDto } from "../cases/dto/create-case.dto";
import { PrismaService } from "../database/prisma.service";

@Controller("client-intake")
@RequireRoles("CLIENT_ADMIN")
@RequirePermissions(Permission.CaseCreate)
export class ClientIntakeController {
  constructor(
    private readonly cases: CasesService,
    private readonly prisma: PrismaService,
  ) {}

  // One request per row preserves normal idempotency and avoids partially committed batch retries.
  @Post("rows")
  async create(
    @CurrentActor() actor: Actor,
    @Body() body: Record<string, unknown>,
  ) {
    if (!actor.clientId)
      throw new ForbiddenException("A client workspace is required");
    const client = await this.prisma.client.findFirst({
      where: { id: actor.clientId, tenantId: actor.tenantId, status: "ACTIVE" },
      select: { publicId: true },
    });
    if (!client)
      throw new ForbiddenException("An active client workspace is required");
    const input = plainToInstance(CreateCaseDto, {
      ...body,
      clientId: client.publicId,
    });
    try {
      await validateOrReject(input, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
    } catch (error) {
      if (!Array.isArray(error)) throw error;
      throw new BadRequestException(
        error.flatMap((row) => Object.values(row.constraints ?? {})),
      );
    }
    return this.cases.create(actor, input);
  }
}
