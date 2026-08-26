import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from "class-validator";

const ActivityTypes = [
  "CALL",
  "EMAIL",
  "MEETING",
  "NOTE",
  "FOLLOW_UP",
] as const;

export class CreateSalesActivityDto {
  @IsIn(ActivityTypes)
  type!: string;

  @IsString()
  @Length(2, 1000)
  summary!: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;
}
