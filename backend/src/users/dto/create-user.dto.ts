import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from "class-validator";
import {
  MIN_USER_PASSWORD_LENGTH,
  USER_PASSWORD_PATTERN,
  USER_PASSWORD_REQUIREMENTS,
} from "../../auth/password-policy";

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @Length(2, 120) displayName!: string;
  @IsOptional() @IsString() @Length(7, 24) phone?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  roleCodes!: string[];
  @IsString()
  @Length(MIN_USER_PASSWORD_LENGTH, 200)
  @Matches(USER_PASSWORD_PATTERN, {
    message: `temporaryPassword ${USER_PASSWORD_REQUIREMENTS}`,
  })
  temporaryPassword!: string;
}
