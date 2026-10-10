import {
  COLOUR_MATRIX,
  COLOUR_NAMES,
  RESULT_FOR_COLOUR,
} from "../verification/colour-matrix";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { ManagerReviewDto } from "../reports/dto/manager-review.dto";
import { ManagerReviewService } from "../reports/manager-review.service";
import { DepartmentsService } from "./departments.service";
import { ClientRmService } from "./client-rm.service";
import { CaseHoldService } from "./case-hold.service";
import {
  AssignClientRmDto,
  AssignDataEntryDto,
  ClearClientRmDto,
  ClientRmQueryDto,
  AssignTaskDto,
  CreateDepartmentDto,
  InitiateCheckDto,
  IntakeRulesDto,
  RmQueueQueryDto,
  RouteChecksDto,
  SendBackDto,
  SetMemberDto,
  UpdateDepartmentDto,
  VersionedNoteDto,
  WorkQueueQueryDto,
} from "./dto/workflow.dto";
import { IntakeService } from "./intake.service";
import { RoutingService } from "./routing.service";

/**
 * Internal v2 flow: RM -> Data Entry -> Ready -> RM routing -> Team Leader -> member.
 * Every handler is role-gated here and re-checks ownership/membership in its service.
 */
@Controller("workflow")
export class WorkflowController {
  constructor(
    private readonly departments: DepartmentsService,
    private readonly intake: IntakeService,
    private readonly routing: RoutingService,
    private readonly finalReview: ManagerReviewService,
    private readonly clientRms: ClientRmService,
    private readonly holds: CaseHoldService,
  ) {}

  @Get("clients")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  listClientRms(
    @CurrentActor() actor: Actor,
    @Query() query: ClientRmQueryDto,
  ) {
    return this.clientRms.list(actor, query);
  }

  @Post("clients/:clientId/rm")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  assignClientRm(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Body() input: AssignClientRmDto,
  ) {
    return this.clientRms.assign(actor, clientId, input);
  }

  /** Route A and the auto Data Entry rule for one company. */
  @Patch("clients/:clientId/intake-rules")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  setIntakeRules(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Body() input: IntakeRulesDto,
  ) {
    return this.clientRms.setIntakeRules(actor, clientId, input);
  }

  @Post("clients/:clientId/rm/clear")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  clearClientRm(
    @CurrentActor() actor: Actor,
    @Param("clientId", ParseUUIDPipe) clientId: string,
    @Body() input: ClearClientRmDto,
  ) {
    return this.clientRms.clear(actor, clientId, input.version);
  }

  @Post("cases/:caseId/stop")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM")
  stopCase(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: SendBackDto,
  ) {
    return this.holds.stop(actor, caseId, input);
  }

  @Post("cases/:caseId/resume")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM")
  resumeCase(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: VersionedNoteDto,
  ) {
    return this.holds.resume(actor, caseId, input);
  }

  @Get("departments")
  @RequireRoles(
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "SPOC_RM",
    "DATA_ENTRY",
    "VERIFIER",
  )
  listDepartments(@CurrentActor() actor: Actor) {
    return this.departments.list(actor);
  }

  @Post("departments")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  createDepartment(
    @CurrentActor() actor: Actor,
    @Body() input: CreateDepartmentDto,
  ) {
    return this.departments.create(actor, input);
  }

  @Patch("departments/:departmentId")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  updateDepartment(
    @CurrentActor() actor: Actor,
    @Param("departmentId", ParseUUIDPipe) departmentId: string,
    @Body() input: UpdateDepartmentDto,
  ) {
    return this.departments.update(actor, departmentId, input);
  }

  @Post("departments/:departmentId/members")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  setMember(
    @CurrentActor() actor: Actor,
    @Param("departmentId", ParseUUIDPipe) departmentId: string,
    @Body() input: SetMemberDto,
  ) {
    return this.departments.setMember(actor, departmentId, input);
  }

  @Delete("departments/:departmentId/members/:userId")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  removeMember(
    @CurrentActor() actor: Actor,
    @Param("departmentId", ParseUUIDPipe) departmentId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
  ) {
    return this.departments.removeMember(actor, departmentId, userId);
  }

  @Get("rm/queue")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM")
  rmQueue(@CurrentActor() actor: Actor, @Query() query: RmQueueQueryDto) {
    return this.intake.rmQueue(actor, query);
  }

  @Post("cases/:caseId/data-entry")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM", "DATA_ENTRY")
  assignDataEntry(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: AssignDataEntryDto,
  ) {
    return this.intake.assignDataEntry(actor, caseId, input);
  }

  @Get("data-entry/queue")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "DATA_ENTRY")
  dataEntryQueue(
    @CurrentActor() actor: Actor,
    @Query() query: WorkQueueQueryDto,
  ) {
    return this.intake.dataEntryQueue(actor, query);
  }

  @Get("initiation-forms")
  @RequireRoles(
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "SPOC_RM",
    "DATA_ENTRY",
    "VERIFIER",
  )
  initiationForms() {
    return this.intake.initiationForms();
  }

  /** Standard colour matrix: per check type, the situations and the colour each means. */
  @Get("colour-matrix")
  @RequireRoles(
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
    "SPOC_RM",
    "VERIFIER",
    "QA_REVIEWER",
  )
  colourMatrix() {
    return {
      matrix: COLOUR_MATRIX,
      colourNames: COLOUR_NAMES,
      resultFor: RESULT_FOR_COLOUR,
    };
  }

  /** Data Entry records a check's initiation details (check-wise initiation). */
  @Put("cases/:caseId/checks/:checkId/initiation")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "DATA_ENTRY")
  initiateCheck(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Body() input: InitiateCheckDto,
  ) {
    return this.intake.initiateCheck(actor, caseId, checkId, input);
  }

  @Post("cases/:caseId/ready")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "DATA_ENTRY")
  markReady(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: VersionedNoteDto,
  ) {
    return this.intake.markReady(actor, caseId, input);
  }

  @Post("cases/:caseId/send-back")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM")
  sendBack(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: SendBackDto,
  ) {
    return this.intake.sendBack(actor, caseId, input);
  }

  @Get("cases/:caseId/routing")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM")
  routingPlan(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.routing.plan(actor, caseId);
  }

  @Post("cases/:caseId/routing")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM")
  route(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: RouteChecksDto,
  ) {
    return this.routing.route(actor, caseId, input);
  }

  @Get("cases/:caseId/final-review")
  @RequireRoles("SPOC_RM")
  finalReviewOverview(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.finalReview.overviewAsRm(actor, caseId);
  }

  @Post("cases/:caseId/final-review")
  @RequireRoles("SPOC_RM")
  decideFinalReview(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() input: ManagerReviewDto,
  ) {
    return this.finalReview.decideAsRm(actor, caseId, input);
  }

  @Get("team/queue")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  teamQueue(@CurrentActor() actor: Actor, @Query() query: WorkQueueQueryDto) {
    return this.routing.teamQueue(actor, query);
  }

  @Post("tasks/:taskId/assignee")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  assignTask(
    @CurrentActor() actor: Actor,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() input: AssignTaskDto,
  ) {
    return this.routing.assignTask(actor, taskId, input);
  }
}
