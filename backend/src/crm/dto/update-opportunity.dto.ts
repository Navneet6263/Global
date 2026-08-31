import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import {
  INDIAN_MOBILE_MESSAGE,
  INDIAN_MOBILE_PATTERN,
  normalizeIndianMobile,
} from "../../common/validation/indian-mobile";
import { OpportunityStages } from "./create-opportunity.dto";

export class UpdateOpportunityDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(2, 180)
  companyName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  city?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  industry?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  contactName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  contactTitle?: string | null;

  @IsOptional()
  @IsIn(OpportunityStages)
  stage?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeIndianMobile(value))
  @Matches(INDIAN_MOBILE_PATTERN, {
    message: `contactPhone ${INDIAN_MOBILE_MESSAGE}`,
  })
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 48)
  source?: string;

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
  @IsDateString()
  nextFollowUpAt?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  lostReason?: string;

  @IsOptional()
  @IsString()
  @Length(2, 1000)
  activitySummary?: string;
}
