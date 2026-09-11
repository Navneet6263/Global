import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { CheckInFieldVisitDto } from "./dto/check-in-field-visit.dto";
import type { CompleteFieldVisitDto } from "./dto/complete-field-visit.dto";
import type { CreateFieldVisitDto } from "./dto/create-field-visit.dto";
import type { ReviewFieldExceptionDto } from "./dto/review-field-exception.dto";
import { FieldVisitAssignmentService } from "./field-visit-assignment.service";
import { FieldVisitCheckInService } from "./field-visit-check-in.service";
import { FieldVisitCompletionService } from "./field-visit-completion.service";
import { FieldVisitExceptionService } from "./field-visit-exception.service";
import { FieldVisitQueryService } from "./field-visit-query.service";
import type { FieldAssigneeQueryDto } from "./dto/field-assignee-query.dto";

export { mergeFieldVisitQueue } from "./field-visit-query.service";

/** Stable controller-facing facade for the field workflow. */
@Injectable()
export class FieldVisitsService {
  constructor(
    private readonly queries: FieldVisitQueryService,
    private readonly assignments: FieldVisitAssignmentService,
    private readonly checkIns: FieldVisitCheckInService,
    private readonly completions: FieldVisitCompletionService,
    private readonly exceptions: FieldVisitExceptionService,
  ) {}

  mine(actor: Actor) {
    return this.queries.mine(actor);
  }

  eligibleAssignees(
    actor: Actor,
    casePublicId: string,
    query: FieldAssigneeQueryDto,
  ) {
    return this.assignments.eligibleAssignees(actor, casePublicId, query);
  }

  create(actor: Actor, casePublicId: string, input: CreateFieldVisitDto) {
    return this.assignments.create(actor, casePublicId, input);
  }

  checkIn(actor: Actor, visitPublicId: string, input: CheckInFieldVisitDto) {
    return this.checkIns.checkIn(actor, visitPublicId, input);
  }

  complete(actor: Actor, visitPublicId: string, input: CompleteFieldVisitDto) {
    return this.completions.complete(actor, visitPublicId, input);
  }

  reviewException(
    actor: Actor,
    visitPublicId: string,
    input: ReviewFieldExceptionDto,
  ) {
    return this.exceptions.review(actor, visitPublicId, input);
  }
}
