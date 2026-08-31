import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const DirectoryRoleCodes = [
  "PLATFORM_ADMIN",
  "OPS_MANAGER",
  "VERIFIER",
  "QA_REVIEWER",
  "CLIENT_ADMIN",
  "FIELD_EXECUTIVE",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
] as const;

export const DirectoryStatuses = ["ACTIVE", "SUSPENDED", "INVITED"] as const;

export class UserDirectoryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase() : value,
  )
  @IsIn(DirectoryRoleCodes)
  role?: (typeof DirectoryRoleCodes)[number];

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase() : value,
  )
  @IsIn(DirectoryStatuses)
  status?: (typeof DirectoryStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
