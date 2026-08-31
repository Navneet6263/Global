import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from "class-validator";
import { OpportunityStages } from "./create-opportunity.dto";
import { PageQueryDto } from "../../common/dto/page-query.dto";

export class ListOpportunitiesDto extends PageQueryDto {
  @IsOptional()
  @IsIn([
    "all",
    "mine",
    "unassigned",
    "high-value",
    "closing-month",
    "followup-overdue",
    "stale",
    "won-month",
    "lost-month",
  ])
  savedView?: string;

  @IsOptional()
  @IsIn(OpportunityStages)
  stage?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== "unassigned")
  @IsUUID()
  owner?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minProbability?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxProbability?: number;

  @IsOptional()
  @IsDateString()
  closeFrom?: string;

  @IsOptional()
  @IsDateString()
  closeTo?: string;

  @IsOptional()
  @IsIn(["overdue", "today", "upcoming", "none"])
  followUp?: string;

  @IsOptional()
  @IsIn(["value", "probability", "close", "recent"])
  sort?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100_000)
  page = 1;
}
