import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from "class-validator";
import {
  INDIAN_MOBILE_MESSAGE,
  INDIAN_MOBILE_PATTERN,
  normalizeIndianMobile,
} from "../../common/validation/indian-mobile";
import {
  MIN_USER_PASSWORD_LENGTH,
  USER_PASSWORD_PATTERN,
  USER_PASSWORD_REQUIREMENTS,
} from "../../auth/password-policy";

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @Length(2, 120) displayName!: string;
  @IsOptional()
  @Transform(({ value }) => normalizeIndianMobile(value))
  @Matches(INDIAN_MOBILE_PATTERN, { message: `phone ${INDIAN_MOBILE_MESSAGE}` })
  phone?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  roleCodes!: string[];
  @IsOptional() @IsBoolean() additionalAccessConfirmed?: boolean;
  @IsString()
  @Length(MIN_USER_PASSWORD_LENGTH, 200)
  @Matches(USER_PASSWORD_PATTERN, {
    message: `temporaryPassword ${USER_PASSWORD_REQUIREMENTS}`,
  })
  temporaryPassword!: string;
}
