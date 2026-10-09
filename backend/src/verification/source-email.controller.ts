import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from "class-validator";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { SourceEmailService } from "./source-email.service";

export class SourceEmailDto {
  @IsEmail() to!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsEmail({}, { each: true })
  cc?: string[];
  @IsString() @Length(5, 300) subject!: string;
  @IsString() @Length(20, 8000) body!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID("all", { each: true })
  documentIds?: string[];
  @IsOptional() @IsBoolean() autoFollowUp?: boolean;
}

export class StopSourceEmailDto {
  @IsString() @Length(3, 300) reason!: string;
}

/** Employer / university verification emails with automatic follow-ups. */
@Controller("checks/:checkId/source-emails")
export class SourceEmailController {
  constructor(private readonly emails: SourceEmailService) {}

  @Get()
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER", "QA_REVIEWER")
  @RequirePermissions(Permission.CaseRead)
  compose(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
  ) {
    return this.emails.compose(actor, checkId);
  }

  @Post()
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.TaskWrite)
  send(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Body() input: SourceEmailDto,
  ) {
    return this.emails.send(actor, checkId, input);
  }

  @Post(":emailId/stop")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.TaskWrite)
  stop(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Param("emailId", ParseUUIDPipe) emailId: string,
    @Body() input: StopSourceEmailDto,
  ) {
    return this.emails.stop(actor, checkId, emailId, input.reason);
  }
}
