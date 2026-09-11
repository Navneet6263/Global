import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { ClientCommercialService } from "./client-commercial.service";
import { UpdateCommercialDto } from "./dto/update-commercial.dto";

@Controller("clients")
@RequireRoles("PLATFORM_ADMIN", "SALES_MANAGER")
export class ClientCommercialController {
  constructor(private readonly commercial: ClientCommercialService) {}

  @Get(":clientId/commercial")
  @RequirePermissions(Permission.ClientRead)
  get(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
  ) {
    return this.commercial.get(actor, clientId);
  }

  @Put(":clientId/commercial")
  @RequirePermissions(Permission.ClientWrite)
  update(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Body() input: UpdateCommercialDto,
  ) {
    return this.commercial.update(actor, clientId, input);
  }
}
