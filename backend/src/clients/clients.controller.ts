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
import { ClientsService } from "./clients.service";
import { ClientQueryDto } from "./dto/client-query.dto";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@Controller("clients")
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @RequireRoles(
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "SALES_MANAGER",
    "FINANCE_MANAGER",
  )
  @RequirePermissions(Permission.ClientRead)
  list(@CurrentActor() actor: Actor, @Query() query: ClientQueryDto) {
    return this.clients.list(actor, query);
  }

  @Post()
  @RequireRoles("PLATFORM_ADMIN", "SALES_MANAGER")
  @RequirePermissions(Permission.ClientWrite)
  create(@CurrentActor() actor: Actor, @Body() input: CreateClientDto) {
    return this.clients.create(actor, input);
  }

  @Patch(":clientId")
  @RequireRoles("PLATFORM_ADMIN", "SALES_MANAGER")
  @RequirePermissions(Permission.ClientWrite)
  update(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Body() input: UpdateClientDto,
  ) {
    return this.clients.update(actor, clientId, input);
  }
}
