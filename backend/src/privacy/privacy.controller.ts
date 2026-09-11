import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  CreatePrivacyRecordDto,
  PrivacyQueryDto,
  UpdatePrivacyRecordDto,
} from "./privacy.dto";
import { PrivacyQueryService } from "./privacy-query.service";
import { PrivacyService } from "./privacy.service";

@Controller("privacy-records")
@RequireRoles("PLATFORM_ADMIN")
@RequirePermissions(Permission.SettingsManage)
export class PrivacyController {
  constructor(
    private readonly records: PrivacyService,
    private readonly query: PrivacyQueryService,
  ) {}
  @Get()
  list(@CurrentActor() actor: Actor, @Query() input: PrivacyQueryDto) {
    return this.query.list(actor, input);
  }
  @Post()
  create(@CurrentActor() actor: Actor, @Body() input: CreatePrivacyRecordDto) {
    return this.records.create(actor, input);
  }
  @Get(":recordId")
  get(
    @CurrentActor() actor: Actor,
    @Param("recordId", ParseUUIDPipe) id: string,
  ) {
    return this.query.get(actor, id);
  }
  @Patch(":recordId")
  update(
    @CurrentActor() actor: Actor,
    @Param("recordId", ParseUUIDPipe) id: string,
    @Body() input: UpdatePrivacyRecordDto,
  ) {
    return this.records.update(actor, id, input);
  }
  @Get(":recordId/events")
  events(
    @CurrentActor() actor: Actor,
    @Param("recordId", ParseUUIDPipe) id: string,
    @Query() input: PrivacyQueryDto,
  ) {
    return this.query.events(actor, id, input);
  }
}
