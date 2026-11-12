import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const OPS_QUEUE_FILTER_STATUSES = [
  "OPEN",
  "RESPONDED",
  "CANDIDATE_SUBMITTED",
  "DATA_ENTRY_PENDING",
  "RESOLVED",
  "ALL",
] as const;

export class OpsClarificationQueueQueryDto {
  @IsOptional()
  @IsIn([...OPS_QUEUE_FILTER_STATUSES])
  status?: (typeof OPS_QUEUE_FILTER_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class OpsCompleteClarificationDto {
  @IsOptional()
  @IsUUID()
  dataEntryUserId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;
}

export class ReentryQueueQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class RejectL2DocumentDto {
  @IsString()
  @Length(5, 1000)
  reason!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  documentVersion?: number;
}

export class CompleteL2ReentryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  documentVersion?: number;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  entries?: Array<Record<string, unknown>>;
}

export const L1_QUEUE_FILTER_STATES = [
  "all",
  "overdue",
  "awaiting_client",
  "response_received",
] as const;

export class L1ClarificationQueueQueryDto {
  @IsOptional()
  @IsIn([...L1_QUEUE_FILTER_STATES])
  state?: (typeof L1_QUEUE_FILTER_STATES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
