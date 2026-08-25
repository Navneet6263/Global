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
import { IsIn, IsOptional } from "class-validator";
import { PageQueryDto } from "../common/dto/page-query.dto";
import {
  CurrentActor,
  RequirePermissions,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { Permission } from "../common/auth/permissions";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TasksService } from "./tasks.service";

class TaskQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"])
  status?: string;

  @IsOptional()
  @IsIn(["ACTIVE"])
  view?: string;
}

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get("tasks/mine")
  @RequirePermissions(Permission.TaskRead)
  mine(@CurrentActor() actor: Actor, @Query() query: TaskQueryDto) {
    return this.tasks.mine(actor, query);
  }

  @Post("checks/:checkId/tasks")
  @RequirePermissions(Permission.TaskWrite)
  create(
    @CurrentActor() actor: Actor,
    @Param("checkId", ParseUUIDPipe) checkId: string,
    @Body() input: CreateTaskDto,
  ) {
    return this.tasks.create(actor, checkId, input);
  }

  @Patch("tasks/:taskId")
  @RequirePermissions(Permission.TaskWrite)
  update(
    @CurrentActor() actor: Actor,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() input: UpdateTaskDto,
  ) {
    return this.tasks.update(actor, taskId, input);
  }
}
