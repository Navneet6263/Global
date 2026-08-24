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
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { PageQueryDto } from "../common/dto/page-query.dto";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@Controller("clients")
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @RequirePermissions(Permission.ClientRead)
  list(@CurrentActor() actor: Actor, @Query() query: PageQueryDto) {
    return this.clients.list(actor, query);
  }

  @Post()
  @RequirePermissions(Permission.ClientWrite)
  create(@CurrentActor() actor: Actor, @Body() input: CreateClientDto) {
    return this.clients.create(actor, input);
  }

  @Patch(":clientId")
  @RequirePermissions(Permission.ClientWrite)
  update(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Body() input: UpdateClientDto,
  ) {
    return this.clients.update(actor, clientId, input);
  }
}
