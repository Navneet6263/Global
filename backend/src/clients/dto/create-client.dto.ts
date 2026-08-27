import { Transform } from "class-transformer";
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
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

export class CreateClientDto {
  @IsString()
  @Length(2, 32)
  code!: string;

  @IsString()
  @Length(2, 180)
  legalName!: string;

  @IsString()
  @Length(2, 120)
  displayName!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  contactName?: string;

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
  @IsInt()
  @Min(4)
  @Max(720)
  slaHours = 72;
}
