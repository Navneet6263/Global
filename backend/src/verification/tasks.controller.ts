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
import { IsIn, IsOptional, IsUUID } from "class-validator";
import { PageQueryDto } from "../common/dto/page-query.dto";
import {
  CurrentActor,
  RequirePermissions,
  RequireRoles,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { BulkTaskAssignmentService } from "./bulk-task-assignment.service";
import { BulkAssignTasksDto } from "./dto/bulk-assign-tasks.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { ReassignTaskDto } from "./dto/reassign-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TaskAssignmentService } from "./task-assignment.service";
import { TasksService } from "./tasks.service";

class TaskQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsIn(["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"])
  status?: string;

  @IsOptional()
  @IsIn(["ACTIVE"])
  view?: string;

  @IsOptional()
  @IsIn(["OVERDUE", "DUE_TODAY", "DUE_SOON"])
  sla?: "OVERDUE" | "DUE_TODAY" | "DUE_SOON";
}

@Controller()
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly assignments: TaskAssignmentService,
    private readonly bulkAssignments: BulkTaskAssignmentService,
  ) {}

  @Get("tasks/mine")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.TaskRead)
  mine(@CurrentActor() actor: Actor, @Query() query: TaskQueryDto) {
    return this.tasks.mine(actor, query);
  }

  @Get("tasks/mine/insights")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.TaskRead)
  insights(@CurrentActor() actor: Actor) {
    return this.tasks.insights(actor);
  }

  @Get("tasks/:taskId/context")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER")
  @RequirePermissions(Permission.TaskRead)
  context(
    @CurrentActor() actor: Actor,
    @Param("taskId", ParseUUIDPipe) taskId: string,
  ) {
    return this.tasks.context(actor, taskId);
  }

  @Post("checks/:checkId/tasks")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  @RequirePermissions(Permission.TaskWrite)
  create(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Body() input: CreateTaskDto,
  ) {
    return this.tasks.create(actor, checkId, input);
  }

  @Post("tasks/bulk-assignment")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  @RequirePermissions(Permission.TaskWrite)
  bulkAssign(@CurrentActor() actor: Actor, @Body() input: BulkAssignTasksDto) {
    return this.bulkAssignments.assign(actor, input);
  }

  @Patch("tasks/:taskId/assignee")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER")
  @RequirePermissions(Permission.TaskWrite)
  reassign(
    @CurrentActor() actor: Actor,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() input: ReassignTaskDto,
  ) {
    return this.assignments.reassign(actor, taskId, input);
  }

  @Patch("tasks/:taskId")
  @RequireRoles("VERIFIER")
  @RequirePermissions(Permission.TaskWrite)
  update(
    @CurrentActor() actor: Actor,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() input: UpdateTaskDto,
  ) {
    return this.tasks.update(actor, taskId, input);
  }
}
