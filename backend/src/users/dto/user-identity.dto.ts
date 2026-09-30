import { Transform } from "class-transformer";
import {
  IsEmail,
  IsOptional,
  IsString,
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

/**
 * Who the person is and their first password: the fields every user-ID creation
 * shares (Admin/Ops creation and a Main Vendor's team). Subclasses add scope fields.
 */
export class UserIdentityDto {
  @IsEmail() email!: string;
  @IsString() @Length(2, 120) displayName!: string;
  @IsOptional()
  @Transform(({ value }) => normalizeIndianMobile(value))
  @Matches(INDIAN_MOBILE_PATTERN, { message: `phone ${INDIAN_MOBILE_MESSAGE}` })
  phone?: string;
  @IsString()
  @Length(MIN_USER_PASSWORD_LENGTH, 200)
  @Matches(USER_PASSWORD_PATTERN, {
    message: `temporaryPassword ${USER_PASSWORD_REQUIREMENTS}`,
  })
  temporaryPassword!: string;
}
