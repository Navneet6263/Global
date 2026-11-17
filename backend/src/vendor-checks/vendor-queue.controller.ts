import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { ApprovedVendorGuard } from "../vendor-onboarding/guards/approved-vendor.guard";
import { EXTRA_COST_MAX } from "./vendor-check-rules";
import { VendorQueueService } from "./vendor-queue.service";
import { VendorRatesService } from "./vendor-rates.service";
import { VendorVersionDto } from "./vendor-work.controller";

export class VendorQueueQueryDto {
  @IsOptional() @IsString() @MaxLength(40) checkType?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
}

export class VendorReleaseDto extends VendorVersionDto {
  @IsString() @MaxLength(1000) reason!: string;
}

export class VendorTeamReviewDto extends VendorVersionDto {
  @IsIn(["APPROVE", "RETURN"]) decision!: "APPROVE" | "RETURN";
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class VendorExtraCostDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(EXTRA_COST_MAX)
  amount!: number;
  @IsString() @MaxLength(1000) reason!: string;
}

export class VendorRateDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) price!: number;
  @IsInt() @Min(0) version!: number;
}

/** Vendor side of the open queue: browse, pick, return, team review, extra cost. */
@Controller("vendor")
@RequireRoles("VENDOR")
@RequirePermissions(Permission.VendorReview)
@UseGuards(ApprovedVendorGuard)
export class VendorQueueController {
  constructor(private readonly queue: VendorQueueService) {}

  @Get("queue")
  open(@CurrentActor() actor: Actor, @Query() query: VendorQueueQueryDto) {
    return this.queue.open(actor, query);
  }

  @Post("queue/:jobId/pick")
  pick(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() input: VendorVersionDto,
  ) {
    return this.queue.pick(actor, jobId, input.version);
  }

  @Post("checks/:jobId/release")
  release(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() input: VendorReleaseDto,
  ) {
    return this.queue.release(actor, jobId, input);
  }

  @Post("checks/:jobId/team-review")
  teamReview(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() input: VendorTeamReviewDto,
  ) {
    return this.queue.teamReview(actor, jobId, input);
  }

  @Post("checks/:jobId/extra-costs")
  addExtraCost(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() input: VendorExtraCostDto,
  ) {
    return this.queue.addExtraCost(actor, jobId, input);
  }

  @Delete("checks/:jobId/extra-costs/:costId")
  removeExtraCost(
    @CurrentActor() actor: Actor,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Param("costId", ParseUUIDPipe) costId: string,
  ) {
    return this.queue.removeExtraCost(actor, jobId, costId);
  }
}

/** Vendor rates: every internal user reads them; Operations sets them. */
@Controller("vendor-rates")
export class VendorRatesController {
  constructor(private readonly rates: VendorRatesService) {}

  @Get()
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM", "VERIFIER")
  list(@CurrentActor() actor: Actor) {
    return this.rates.list(actor);
  }

  @Put(":checkType")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  set(
    @CurrentActor() actor: Actor,
    @Param("checkType") checkType: string,
    @Body() input: VendorRateDto,
  ) {
    return this.rates.set(actor, checkType, input);
  }
}
