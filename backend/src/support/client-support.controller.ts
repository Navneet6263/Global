import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { CreateSupportRequestService } from "./services/create-support-request.service";
import { RequesterSupportRequestsService } from "./services/requester-support-requests.service";
import { SUPPORT_ROUTES } from "./support.routes";
import {
  ClientSupportRequestDto,
  MySupportRequestQueryDto,
} from "./support.validation";

/**
 * Client Admin support (/support-requests): raise a request and follow its status
 * and reply. A separate controller so its guard can never widen the agent desk.
 */
@Controller(SUPPORT_ROUTES.clientRequests)
@RequireRoles("CLIENT_ADMIN")
@RequirePermissions(Permission.SupportRequest)
export class ClientSupportController {
  constructor(
    private readonly creator: CreateSupportRequestService,
    private readonly requests: RequesterSupportRequestsService,
  ) {}

  @Post()
  create(@CurrentActor() actor: Actor, @Body() input: ClientSupportRequestDto) {
    return this.creator.forClientAdmin(actor, input);
  }

  @Get()
  mine(@CurrentActor() actor: Actor, @Query() query: MySupportRequestQueryDto) {
    return this.requests.forClientAdmin(actor, query);
  }
}
