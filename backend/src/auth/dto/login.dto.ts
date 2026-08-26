import { IsEmail, IsString, Length, Matches, MinLength } from "class-validator";
import { MIN_USER_PASSWORD_LENGTH } from "../password-policy";

export class LoginDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @Length(2, 32)
  tenantCode!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(MIN_USER_PASSWORD_LENGTH)
  password!: string;
}
