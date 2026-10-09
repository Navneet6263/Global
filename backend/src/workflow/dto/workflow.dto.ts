import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { CheckTypes } from "../../cases/case.constants";

export const DepartmentKinds = ["DATA_ENTRY", "VERIFICATION"] as const;
export const MemberRoles = ["LEAD", "MEMBER"] as const;

/** Check-wise initiation entries; the service validates each field for the check type. */
export class InitiateCheckDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsObject({ each: true })
  entries!: Array<Record<string, unknown>>;
}

export class VersionedNoteDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;
}

export class AssignDataEntryDto extends VersionedNoteDto {
  @IsUUID()
  assigneeId!: string;
}

export class SendBackDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(3, 1000)
  reason!: string;
}

export class CheckRouteDto {
  @IsUUID()
  checkId!: string;

  @IsUUID()
  departmentId!: string;
}

export class RouteChecksDto extends VersionedNoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => CheckRouteDto)
  routes!: CheckRouteDto[];
}

export class AssignTaskDto {
  @IsUUID()
  assigneeId!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;
}

export class CreateDepartmentDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z][A-Z0-9_]{1,31}$/, {
    message: "code must be 2-32 capital letters, digits or underscores",
  })
  code!: string;

  @IsString()
  @Length(2, 80)
  name!: string;

  @IsIn(DepartmentKinds)
  kind!: (typeof DepartmentKinds)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(CheckTypes.length)
  @IsIn(CheckTypes, { each: true })
  checkTypes?: string[];
}

export class UpdateDepartmentDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(CheckTypes.length)
  @IsIn(CheckTypes, { each: true })
  checkTypes?: string[];
}

export class SetMemberDto {
  @IsUUID()
  userId!: string;

  @IsIn(MemberRoles)
  role!: (typeof MemberRoles)[number];
}

export class WorkQueueQueryDto {
  @IsOptional()
  @IsIn(["mine", "team", "unassigned", "all", "review"])
  view?: "mine" | "team" | "unassigned" | "all" | "review";

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

export class RmQueueQueryDto {
  @IsOptional()
  @IsIn([
    "needs_data_entry",
    "with_data_entry",
    "correction",
    "ready",
    "in_verification",
    "qc",
    "final_approval",
    "all",
  ])
  bucket?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  /** Narrow to one of the RM's companies. */
  @IsOptional()
  @IsUUID()
  clientId?: string;

  /** "due" (default): soonest due first. "newest": latest handover first. */
  @IsOptional()
  @IsIn(["due", "newest"])
  sort?: "due" | "newest";

  /** Cases escalated by the client or Platform Admin, or past their due time. */
  @IsOptional()
  @IsIn(["escalated", "overdue"])
  flag?: "escalated" | "overdue";
}

export class IntakeRulesDto {
  @IsInt()
  @Min(1)
  version!: number;

  /** A Data Entry user, or null to stop auto-assignment. Omit to keep. */
  @IsOptional()
  @IsUUID()
  defaultDataEntryUserId?: string | null;

  @IsOptional()
  @IsBoolean()
  clientReviewFirst?: boolean;
}

export class AssignClientRmDto {
  @IsUUID()
  rmUserId!: string;

  @IsInt()
  @Min(1)
  version!: number;

  /** NONE: only new cases; UNASSIGNED: also open cases without an RM; ALL_OPEN: every open case. */
  @IsOptional()
  @IsIn(["NONE", "UNASSIGNED", "ALL_OPEN"])
  apply?: "NONE" | "UNASSIGNED" | "ALL_OPEN";

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;
}

export class ClearClientRmDto {
  @IsInt()
  @Min(1)
  version!: number;
}

export class ClientRmQueryDto {
  @IsOptional()
  @IsIn(["all", "without_rm", "with_rm"])
  view?: "all" | "without_rm" | "with_rm";

  @IsOptional()
  @IsString()
  @Length(1, 120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
