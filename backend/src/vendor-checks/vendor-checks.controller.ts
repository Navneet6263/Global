import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { VendorChecksService } from "./vendor-checks.service";

export class AssignVendorCheckDto {
  @IsUUID() vendorId!: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  /** Team Leader only: why this check needs a vendor (shown to the RM). */
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID("all", { each: true })
  documentIds!: string[];
}

export class ReviewVendorCheckDto {
  @IsIn(["APPROVE", "RETURN"]) decision!: "APPROVE" | "RETURN";
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsInt() @Min(1) version!: number;
}

export class DecideVendorRequestDto {
  @IsIn(["APPROVE", "REJECT"]) decision!: "APPROVE" | "REJECT";
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsInt() @Min(1) version!: number;
}

export class CancelVendorCheckDto {
  @IsString() @MaxLength(1000) reason!: string;
}

export class VendorBoardQueryDto {
  @IsOptional() @IsString() @MaxLength(16) status?: string;
  @IsOptional() @IsString() @MaxLength(80) search?: string;
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  overdue?: boolean;
  @IsOptional() @IsString() @MaxLength(300) columns?: string;
}

const INTERNAL = [
  "PLATFORM_ADMIN",
  "OPS_MANAGER",
  "SPOC_RM",
  "VERIFIER",
] as const;

/** Internal side: send a check to a vendor, review its result, watch the board. */
@Controller()
@RequireRoles(...INTERNAL)
export class VendorChecksController {
  constructor(private readonly vendorChecks: VendorChecksService) {}

  @Get("checks/:checkId/vendor")
  forCheck(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
  ) {
    return this.vendorChecks.forCheck(actor, checkId);
  }

  @Post("checks/:checkId/vendor")
  assign(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Body() input: AssignVendorCheckDto,
  ) {
    return this.vendorChecks.assign(actor, checkId, input);
  }

  @Post("vendor-checks/:assignmentId/review")
  review(
    @CurrentActor() actor: Actor,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() input: ReviewVendorCheckDto,
  ) {
    return this.vendorChecks.review(actor, assignmentId, input);
  }

  @Post("vendor-checks/:assignmentId/approval")
  decide(
    @CurrentActor() actor: Actor,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() input: DecideVendorRequestDto,
  ) {
    return this.vendorChecks.decide(actor, assignmentId, input);
  }

  @Post("vendor-checks/:assignmentId/cancel")
  cancel(
    @CurrentActor() actor: Actor,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() input: CancelVendorCheckDto,
  ) {
    return this.vendorChecks.cancel(actor, assignmentId, input.reason);
  }

  @Get("vendor-checks")
  board(@CurrentActor() actor: Actor, @Query() query: VendorBoardQueryDto) {
    return this.vendorChecks.board(actor, query);
  }

  @Get("vendor-checks/export")
  export(@CurrentActor() actor: Actor, @Query() query: VendorBoardQueryDto) {
    return this.vendorChecks.export(actor, query);
  }

  @Get("vendor-checks/:assignmentId/evidence/:fileId")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  evidence(
    @CurrentActor() actor: Actor,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    return this.vendorChecks.evidence(actor, assignmentId, fileId);
  }
}
