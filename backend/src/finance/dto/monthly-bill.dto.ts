import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, Matches, Min } from "class-validator";

const PERIOD = /^20\d{2}-(0[1-9]|1[0-2])$/;

/** The month the bills are for, e.g. "2026-10". */
export class MonthlyBillPeriodDto {
  @Matches(PERIOD, { message: "period must use YYYY-MM format" })
  period!: string;
}

export class IssueMonthlyBillDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  /** Payment due date; 30 days from issue when left out. */
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
