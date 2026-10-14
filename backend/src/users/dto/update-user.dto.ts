import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { UserDepartmentDto } from "./create-user.dto";

export class UpdateUserDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsIn(["ACTIVE", "SUSPENDED"]) status?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ArrayUnique()
  @IsString({ each: true })
  roleCodes?: string[];
  @IsOptional() @IsBoolean() additionalAccessConfirmed?: boolean;
  /** SPOC-RM only: replaces the client workspaces it may monitor (empty removes all). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  spocClientIds?: string[];
  /** Every team the person should be in, Team Leader per team (replaces memberships). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => UserDepartmentDto)
  departments?: UserDepartmentDto[];
}
