import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const operationsActionKinds = [
  "documents",
  "start",
  "checks",
  "field_assignment",
  "field_review",
  "clarifications",
] as const;
export type OperationsActionKind = (typeof operationsActionKinds)[number];

export class OperationsActionQueryDto {
  @IsIn(operationsActionKinds)
  action: OperationsActionKind = "documents";

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 8;
}
