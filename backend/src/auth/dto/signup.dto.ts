import { Transform } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class SignupStartDto {
  @Transform(trim) @IsString() @Length(2, 120) fullName!: string;
  @Transform(trim) @IsString() @Length(2, 180) companyName!: string;
  @Transform(trim) @IsEmail() @MaxLength(254) email!: string;
  @IsOptional()
  @Transform(trim)
  @Matches(/^$|^[+0-9 ()-]{7,24}$/)
  phone?: string;
  @IsString() @Length(7, 128) password!: string;
  @IsBoolean() @Equals(true) acceptTerms!: boolean;
}

export class SignupResendDto {
  @IsUUID() signupId!: string;
}

export class SignupVerifyDto {
  @IsUUID() signupId!: string;
  @Matches(/^\d{6}$/) otp!: string;
}
