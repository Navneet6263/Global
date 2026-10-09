import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import {
  AllowViewOnlyAdmin,
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import {
  CreatePackageDto,
  SetDiscountDto,
  UpdatePackageDto,
} from "./dto/packages.dto";
import { PackagesService } from "./packages.service";

/** Operations Managers and the Platform Admin build packages and set the RM discount limit. */
@Controller("packages")
@AllowViewOnlyAdmin()
@RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
@RequirePermissions(Permission.CaseRead)
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get()
  list(@CurrentActor() actor: Actor) {
    return this.packages.list(actor);
  }

  @Post()
  create(@CurrentActor() actor: Actor, @Body() input: CreatePackageDto) {
    return this.packages.create(actor, input);
  }

  @Patch(":packageId")
  update(
    @CurrentActor() actor: Actor,
    @Param("packageId", ParseUUIDPipe) packageId: string,
    @Body() input: UpdatePackageDto,
  ) {
    return this.packages.update(actor, packageId, input);
  }
}

/** Client discounts: RM within the package limit, Operations / Admin without a limit. */
@Controller("client-pricing")
@AllowViewOnlyAdmin()
@RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM")
@RequirePermissions(Permission.CaseRead)
export class ClientPricingController {
  constructor(private readonly packages: PackagesService) {}

  @Get()
  clients(@CurrentActor() actor: Actor) {
    return this.packages.pricingClients(actor);
  }

  @Get(":clientId")
  pricing(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
  ) {
    return this.packages.clientPricing(actor, clientId);
  }

  @Put(":clientId/:packageId")
  setDiscount(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Param("packageId", ParseUUIDPipe) packageId: string,
    @Body() input: SetDiscountDto,
  ) {
    return this.packages.setDiscount(actor, clientId, packageId, input);
  }
}
