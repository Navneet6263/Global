import { IsEmail, IsString, Length, Matches, MinLength } from "class-validator";

export class LoginDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @Length(2, 32)
  tenantCode!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
