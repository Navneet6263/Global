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
  @Length(14, 200)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
  temporaryPassword!: string;
}
