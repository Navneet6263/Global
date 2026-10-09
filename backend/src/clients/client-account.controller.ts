import { Controller, Get, NotFoundException } from "@nestjs/common";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";

/**
 * The company's own account: who its relationship manager is. Read live from the
 * company record, so it changes the moment Operations assigns or changes the RM.
 * Only the RM's work contact is shared, never internal data.
 */
@Controller("client-account")
@RequireRoles("CLIENT_ADMIN")
export class ClientAccountController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("relationship-manager")
  async relationshipManager(@CurrentActor() actor: Actor) {
    if (!actor.clientId) throw new NotFoundException("No company workspace");
    const client = await this.prisma.client.findFirst({
      where: { id: actor.clientId, tenantId: actor.tenantId },
      select: {
        primaryRmAssignedAt: true,
        primaryRm: {
          select: {
            displayName: true,
            email: true,
            phone: true,
            status: true,
          },
        },
      },
    });
    if (!client) throw new NotFoundException("No company workspace");
    const rm = client.primaryRm?.status === "ACTIVE" ? client.primaryRm : null;
    return {
      rm: rm
        ? {
            name: rm.displayName,
            email: rm.email,
            phone: rm.phone,
            since: client.primaryRmAssignedAt,
          }
        : null,
    };
  }
}
