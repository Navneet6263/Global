import { IsString, Length, Matches } from "class-validator";
import {
  MIN_USER_PASSWORD_LENGTH,
  USER_PASSWORD_PATTERN,
  USER_PASSWORD_REQUIREMENTS,
} from "../password-policy";

export class ChangePasswordDto {
  @IsString()
  @Length(MIN_USER_PASSWORD_LENGTH, 200)
  currentPassword!: string;

  @IsString()
  @Length(MIN_USER_PASSWORD_LENGTH, 200)
  @Matches(USER_PASSWORD_PATTERN, {
    message: `newPassword ${USER_PASSWORD_REQUIREMENTS}`,
  })
  newPassword!: string;
}
