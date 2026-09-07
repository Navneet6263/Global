import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { CreateTaskDto } from "./dto/create-task.dto";
import type { UpdateTaskDto } from "./dto/update-task.dto";
import { TaskCreationService } from "./task-creation.service";
import { TaskContextService } from "./task-context.service";
import { TaskInsightsService } from "./task-insights.service";
import { type MineTaskQuery, TaskQueryService } from "./task-query.service";
import { TaskWorkflowService } from "./task-workflow.service";

/** Stable controller-facing facade for verification task workflows. */
@Injectable()
export class TasksService {
  constructor(
    private readonly queries: TaskQueryService,
    private readonly creation: TaskCreationService,
    private readonly workflow: TaskWorkflowService,
    private readonly insightsService: TaskInsightsService,
    private readonly contextService: TaskContextService,
  ) {}

  mine(actor: Actor, query: MineTaskQuery) {
    return this.queries.mine(actor, query);
  }

  insights(actor: Actor) {
    return this.insightsService.mine(actor);
  }

  context(actor: Actor, taskPublicId: string) {
    return this.contextService.get(actor, taskPublicId);
  }

  create(actor: Actor, checkPublicId: string, input: CreateTaskDto) {
    return this.creation.create(actor, checkPublicId, input);
  }

  update(actor: Actor, taskPublicId: string, input: UpdateTaskDto) {
    return this.workflow.update(actor, taskPublicId, input);
  }
}
