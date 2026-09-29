import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { SUPPORT_ROLES } from "../common/auth/roles";
import { SupportDirectoryService } from "./services/support-directory.service";
import { SupportEmployeeDetailService } from "./services/support-employee-detail.service";
import { SupportInboxService } from "./services/support-inbox.service";
import { UpdateSupportRequestService } from "./services/update-support-request.service";
import { SUPPORT_ROUTES } from "./support.routes";
import {
  SupportEmployeeQueryDto,
  SupportPageQueryDto,
  SupportRequestQueryDto,
  UpdateSupportRequestDto,
} from "./support.validation";

/**
 * The Support Agent desk (/support). Read-only operational visibility; the only
 * write is a support request's own status and reply (support:handle).
 */
@Controller(SUPPORT_ROUTES.desk)
@RequireRoles(...SUPPORT_ROLES)
@RequirePermissions(Permission.SupportRead)
export class SupportController {
  constructor(
    private readonly directory: SupportDirectoryService,
    private readonly employeeDetail: SupportEmployeeDetailService,
    private readonly inbox: SupportInboxService,
    private readonly updates: UpdateSupportRequestService,
  ) {}

  @Get(SUPPORT_ROUTES.summary)
  summary(@CurrentActor() actor: Actor) {
    return this.directory.summary(actor);
  }

  @Get(SUPPORT_ROUTES.clients)
  clients(@CurrentActor() actor: Actor, @Query() query: SupportPageQueryDto) {
    return this.directory.clients(actor, query);
  }

  @Get(SUPPORT_ROUTES.employees)
  employees(
    @CurrentActor() actor: Actor,
    @Query() query: SupportEmployeeQueryDto,
  ) {
    return this.directory.employees(actor, query);
  }

  @Get(SUPPORT_ROUTES.employee)
  employee(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.employeeDetail.detail(actor, caseId);
  }

  @Get(SUPPORT_ROUTES.requests)
  @RequirePermissions(Permission.SupportHandle)
  list(@CurrentActor() actor: Actor, @Query() query: SupportRequestQueryDto) {
    return this.inbox.list(actor, query);
  }

  @Get(SUPPORT_ROUTES.request)
  @RequirePermissions(Permission.SupportHandle)
  detail(
    @CurrentActor() actor: Actor,
    @Param("requestId", ParseUUIDPipe) requestId: string,
  ) {
    return this.inbox.detail(actor, requestId);
  }

  @Patch(SUPPORT_ROUTES.request)
  @RequirePermissions(Permission.SupportHandle)
  update(
    @CurrentActor() actor: Actor,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() input: UpdateSupportRequestDto,
  ) {
    return this.updates.update(actor, requestId, input);
  }
}
