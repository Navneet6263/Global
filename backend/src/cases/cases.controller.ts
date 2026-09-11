import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from "@nestjs/common";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { CaseOperationsService } from "./case-operations.service";
import { CasesService } from "./cases.service";
import { CaseReaderService } from "./case-reader.service";
import { CaseQueryDto } from "./dto/case-query.dto";
import { CaseCatalogQueryDto } from "./dto/case-catalog-query.dto";
import { CreateCaseDto } from "./dto/create-case.dto";
import { AssignCaseOwnerDto, EscalateCaseDto } from "./dto/case-operations.dto";
import { TransitionCaseDto } from "./dto/transition-case.dto";

@Controller("cases")
export class CasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly reader: CaseReaderService,
    private readonly operations: CaseOperationsService,
  ) {}

  @Get()
  @RequireRoles(
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "CLIENT_ADMIN",
    "VERIFIER",
    "QA_REVIEWER",
    "FIELD_EXECUTIVE",
  )
  @RequirePermissions(Permission.CaseRead)
  list(@CurrentActor() actor: Actor, @Query() query: CaseQueryDto) {
    return this.reader.list(actor, query);
  }

  @Get("export")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "CLIENT_ADMIN")
  @RequirePermissions(Permission.CaseRead)
  export(
    @CurrentActor() actor: Actor,
    @Query() query: CaseQueryDto,
  ): Promise<StreamableFile> {
    return this.reader.exportCsv(actor, query);
  }

  @Get("catalog")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "CLIENT_ADMIN")
  @RequirePermissions(Permission.CaseCreate)
  catalog(@CurrentActor() actor: Actor, @Query() query: CaseCatalogQueryDto) {
    return this.cases.catalog(actor, query.clientId);
  }

  @Get(":caseId")
  @RequireRoles(
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "CLIENT_ADMIN",
    "VERIFIER",
    "QA_REVIEWER",
    "FIELD_EXECUTIVE",
  )
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

  @Patch(":caseId/escalation")
  @RequirePermissions(Permission.CaseTransition)
  escalate(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: EscalateCaseDto,
  ) {
    return this.operations.escalate(actor, caseId, input);
  }

  @Patch(":caseId/owner")
  @RequirePermissions(Permission.CaseTransition)
  assignOwner(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: AssignCaseOwnerDto,
  ) {
    return this.operations.assignOwner(actor, caseId, input);
  }
}
