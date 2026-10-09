import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { UserIdentityDto } from "./user-identity.dto";

export class UserDepartmentDto {
  @IsUUID() id!: string;
  @IsOptional() @IsBoolean() lead?: boolean;
}

export class UserAccessDto {
  @IsString() role!: string;
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  permissions!: string[];
}

export class CreateUserDto extends UserIdentityDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  /** SPOC-RM only: the client workspaces it may monitor (may be empty; assign later). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  spocClientIds?: string[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  roleCodes!: string[];
  @IsOptional() @IsBoolean() additionalAccessConfirmed?: boolean;
  /** Teams to join right away (Data Entry / verification), optionally as Team Leader. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => UserDepartmentDto)
  departments?: UserDepartmentDto[];
  /** Narrowed access for a role (creates a personal role on that base). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => UserAccessDto)
  access?: UserAccessDto[];
}
