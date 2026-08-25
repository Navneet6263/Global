import { Transform } from "class-transformer";
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { CheckTypes } from "../../cases/case.constants";

const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const risks = ["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNCLASSIFIED"] as const;

export class ExecutiveQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(CheckTypes)
  checkType?: string;

  @IsOptional()
  @IsIn(priorities)
  priority?: string;

  @IsOptional()
  @IsIn(risks)
  riskLevel?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(3)
  @Max(12)
  months = 6;
}

export class ExecutiveExportQueryDto extends ExecutiveQueryDto {
  @IsIn(["csv", "pdf"])
  format: "csv" | "pdf";
}

export class ExecutiveScheduleDto extends ExecutiveQueryDto {
  @IsEmail()
  recipientEmail: string;

  @IsDateString()
  deliveryAt: string;

  @IsIn(["pdf", "csv"])
  format: "pdf" | "csv";
}
