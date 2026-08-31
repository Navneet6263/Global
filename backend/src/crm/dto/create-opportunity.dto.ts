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

export const OpportunityStages = [
  "NEW",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export class CreateOpportunityDto {
  @IsString()
  @Length(2, 180)
  companyName!: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  city?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  industry?: string | null;

  @IsString()
  @Length(2, 120)
  contactName!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  contactTitle?: string | null;

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
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsIn(OpportunityStages)
  stage = "NEW";

  @IsOptional()
  @IsString()
  @Length(2, 48)
  source?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999_999)
  estimatedValue!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @IsDateString()
  expectedCloseDate!: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2000)
  notes?: string;
}
