import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  IsBoolean,
  ValidateIf,
  IsString,
  MaxLength,
  Max,
  Min,
} from "class-validator";
import { PageQueryDto } from "../../common/dto/page-query.dto";
import { CaseStatuses } from "../case.constants";

export const CaseRegisterStages = [
  "intake",
  "consent",
  "documents",
  "verification",
  "clarification",
  "qa",
  "manager_review",
  "report_pending",
  "payment_pending",
  "completed",
  "cancelled",
  "assignment",
  "field_visit",
] as const;

export const CaseRegisterPriorities = ["NORMAL", "HIGH", "URGENT"] as const;
export const CaseRegisterSlaStates = [
  "healthy",
  "approaching",
  "overdue",
] as const;
export const CaseRegisterSortFields = [
  "updatedAt",
  "sla",
  "candidateName",
  "priority",
  "progress",
] as const;

export class CaseQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["low", "medium", "high"])
  risk?: "low" | "medium" | "high";

  @IsOptional()
  @IsString()
  @MaxLength(160)
  owner?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === "true" ? true : value === "false" ? false : value,
  )
  @IsBoolean()
  unassigned?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === "true" ? true : value === "false" ? false : value,
  )
  @IsBoolean()
  dueToday?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === "true" ? true : value === "false" ? false : value,
  )
  @IsBoolean()
  dueNext7Days?: boolean;

  @IsOptional()
  @IsIn(["all", "operations"])
  view?: "all" | "operations";

  @IsOptional()
  @IsIn(CaseStatuses)
  status?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  /** Page mode is additive; cursor callers can continue omitting these fields. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsIn(CaseRegisterStages)
  stage?: (typeof CaseRegisterStages)[number];

  @IsOptional()
  @IsIn(CaseRegisterPriorities)
  priority?: (typeof CaseRegisterPriorities)[number];

  @IsOptional()
  @IsIn(CaseRegisterSlaStates)
  sla?: (typeof CaseRegisterSlaStates)[number];

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(CaseRegisterSortFields)
  sortBy?: (typeof CaseRegisterSortFields)[number];

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";

  @ValidateIf(
    (query: CaseQueryDto) =>
      query.sortBy === "progress" || query.sortBy === "priority",
  )
  @IsInt()
  @Min(1)
  get rankedPage(): number | undefined {
    return this.page;
  }
}
