import { IsString, Length, Matches } from "class-validator";
import {
  MIN_USER_PASSWORD_LENGTH,
  USER_PASSWORD_PATTERN,
  USER_PASSWORD_REQUIREMENTS,
} from "../../auth/password-policy";

export class ResetUserPasswordDto {
  @IsString()
  @Length(MIN_USER_PASSWORD_LENGTH, 200)
  @Matches(USER_PASSWORD_PATTERN, {
    message: `temporaryPassword ${USER_PASSWORD_REQUIREMENTS}`,
  })
  temporaryPassword!: string;
}
