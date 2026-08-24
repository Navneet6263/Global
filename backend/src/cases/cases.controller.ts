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
import { CasesService } from "./cases.service";
import { CaseReaderService } from "./case-reader.service";
import { CaseQueryDto } from "./dto/case-query.dto";
import { CreateCaseDto } from "./dto/create-case.dto";
import { TransitionCaseDto } from "./dto/transition-case.dto";

@Controller("cases")
export class CasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly reader: CaseReaderService,
  ) {}

  @Get()
  @RequirePermissions(Permission.CaseRead)
  list(@CurrentActor() actor: Actor, @Query() query: CaseQueryDto) {
    return this.reader.list(actor, query);
  }

  @Get(":caseId")
  @RequirePermissions(Permission.CaseRead)
  get(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.reader.get(actor, caseId);
  }

  @Post()
  @RequirePermissions(Permission.CaseCreate)
  create(@CurrentActor() actor: Actor, @Body() input: CreateCaseDto) {
    return this.cases.create(actor, input);
  }

  @Patch(":caseId/status")
  @RequirePermissions(Permission.CaseTransition)
  transition(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: TransitionCaseDto,
  ) {
    return this.cases.transition(actor, caseId, input);
  }
}
