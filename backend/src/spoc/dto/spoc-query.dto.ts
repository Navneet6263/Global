import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { CaseStatuses } from "../../cases/case.constants";
import { SpocBuckets, type SpocBucket } from "../spoc-buckets";
import { SpocHolderRoles } from "../spoc-holder";

const toBoolean = ({ value }: { value: unknown }) =>
  value === "true" ? true : value === "false" ? false : value;

/** Filters shared by the overview and every case-based list. */
export class SpocScopeQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"])
  priority?: string;
}

export class SpocOverviewQueryDto extends SpocScopeQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class SpocPageQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100_000)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"])
  priority?: string;

  /** Role-matrix drill-down bucket (see spoc-buckets.ts). */
  @IsOptional()
  @IsIn(SpocBuckets)
  bucket?: SpocBucket;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export const SpocCaseSorts = ["updatedAt", "dueAt", "createdAt"] as const;

export class SpocCaseQueryDto extends SpocPageQueryDto {
  @IsOptional()
  @IsIn(CaseStatuses)
  status?: string;

  @IsOptional()
  @IsIn(SpocHolderRoles)
  holderRole?: (typeof SpocHolderRoles)[number];

  /** Which role's case buckets `bucket` refers to. */
  @IsOptional()
  @IsIn(["OPS_MANAGER", "CLIENT_ADMIN"])
  bucketRole?: "OPS_MANAGER" | "CLIENT_ADMIN";

  @IsOptional()
  @IsIn(["overdue", "approaching", "healthy"])
  sla?: "overdue" | "approaching" | "healthy";

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unassigned?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activeOnly?: boolean;

  @IsOptional()
  @IsIn(SpocCaseSorts)
  sortBy: (typeof SpocCaseSorts)[number] = "updatedAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir: "asc" | "desc" = "desc";
}

export class SpocTaskQueryDto extends SpocPageQueryDto {
  @IsOptional()
  @IsIn(["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"])
  status?: string;

  @IsOptional()
  @IsIn(["overdue", "dueToday"])
  sla?: "overdue" | "dueToday";

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}

export class SpocQaQueryDto extends SpocPageQueryDto {
  @IsOptional()
  @IsIn(["awaiting", "claimed", "rework", "decided"])
  view: "awaiting" | "claimed" | "rework" | "decided" = "awaiting";
}

export class SpocVisitQueryDto extends SpocPageQueryDto {
  @IsOptional()
  @IsIn([
    "ASSIGNED",
    "IN_PROGRESS",
    "REVIEW_PENDING",
    "EXCEPTION_REVIEW",
    "COMPLETED",
    "CANCELLED",
  ])
  status?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}

export class SpocOpportunityQueryDto extends SpocPageQueryDto {
  @IsOptional()
  @IsIn(["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"])
  stage?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsIn(["overdue", "none"])
  followUp?: "overdue" | "none";
}

export class SpocInvoiceQueryDto extends SpocPageQueryDto {
  @IsOptional()
  @IsIn([
    "ISSUED",
    "PARTIALLY_PAID",
    "PARTIALLY_CREDITED",
    "PAID",
    "CREDITED",
    "SETTLED",
    "CANCELLED",
    "OVERDUE",
  ])
  status?: string;
}

export class SpocClientQueryDto extends SpocPageQueryDto {
  @IsOptional()
  @IsIn(["ONBOARDING", "ACTIVE", "SUSPENDED"])
  status?: string;
}

export class SpocActivityQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
