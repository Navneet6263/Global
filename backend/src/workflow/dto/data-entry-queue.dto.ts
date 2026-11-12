import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";

export const DATA_ENTRY_QUEUE_FILTERS = [
  "all",
  "to_review",
  "correction",
  "l2_reentry",
] as const;

export type DataEntryQueueFilter = (typeof DATA_ENTRY_QUEUE_FILTERS)[number];

/** Query parameters for the unified Data Entry Intake + L2 re-entry queue. */
export class DataEntryUnifiedQueueQueryDto {
  @IsOptional()
  @IsIn(["mine", "team"])
  view?: "mine" | "team";

  @IsOptional()
  @IsIn([...DATA_ENTRY_QUEUE_FILTERS])
  filter?: DataEntryQueueFilter;

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
