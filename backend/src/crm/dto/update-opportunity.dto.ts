import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from "class-validator";
import { OpportunityStages } from "./create-opportunity.dto";

export class UpdateOpportunityDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsIn(OpportunityStages)
  stage?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999_999)
  estimatedValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @Length(2, 1000)
  activitySummary?: string;
}
