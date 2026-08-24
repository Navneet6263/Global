import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from "class-validator";

export class FindingDto {
  @IsIn([
    "IDENTITY_MISMATCH",
    "DATE_MISMATCH",
    "ADDRESS_MISMATCH",
    "RECORD_FOUND",
    "OTHER",
  ])
  kind!: string;

  @IsIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
  severity!: string;

  @IsString()
  @Length(3, 180)
  title!: string;

  @IsString()
  @Length(3, 5000)
  description!: string;

  @IsOptional()
  @IsString()
  @Length(3, 500)
  source?: string;
}

export class UpdateTaskDto {
  @IsIn(["IN_PROGRESS", "COMPLETED", "BLOCKED"])
  status!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsIn(["CLEAR", "DISCREPANCY", "UNABLE_TO_VERIFY"])
  result?: string;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  sourceSummary?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FindingDto)
  findings: FindingDto[] = [];
}
