import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ServicePackagePolicyService,
  UpdatePackageRequirementsDto,
} from "./service-package-policy.service";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { CreateServicePackageDto } from "./dto/create-service-package.dto";
import { UpdateFieldPolicyDto } from "./dto/update-field-policy.dto";
import { SettingsService } from "./settings.service";

@Controller("settings")
@RequirePermissions(Permission.SettingsManage)
@RequireRoles("PLATFORM_ADMIN")
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly packagePolicy: ServicePackagePolicyService,
  ) {}
  @Get("organisation") organisation(@CurrentActor() actor: Actor) {
    return this.settings.organisation(actor);
  }
  @Get("field-policy") fieldPolicy(@CurrentActor() actor: Actor) {
    return this.settings.fieldPolicy(actor);
  }
  @Patch("field-policy") updateFieldPolicy(
    @CurrentActor() actor: Actor,
    @Body() input: UpdateFieldPolicyDto,
  ) {
    return this.settings.updateFieldPolicy(actor, input);
  }
  @Get("branches") branches(@CurrentActor() actor: Actor) {
    return this.settings.branches(actor);
  }
  @Post("branches") createBranch(
    @CurrentActor() actor: Actor,
    @Body() input: CreateBranchDto,
  ) {
    return this.settings.createBranch(actor, input);
  }
  @Get("service-packages") packages(@CurrentActor() actor: Actor) {
    return this.settings.packages(actor);
  }
  @Post("service-packages") createPackage(
    @CurrentActor() actor: Actor,
    @Body() input: CreateServicePackageDto,
  ) {
    return this.settings.createPackage(actor, input);
  }
  @Patch("service-packages/:id/requirements") updateRequirements(
    @CurrentActor() actor: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePackageRequirementsDto,
  ) {
    return this.packagePolicy.update(actor, id, input);
  }
}
