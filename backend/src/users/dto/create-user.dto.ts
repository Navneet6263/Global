import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { UserIdentityDto } from "./user-identity.dto";

export class CreateUserDto extends UserIdentityDto {
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  /** SPOC-RM only: the client workspaces it may monitor (at least one). */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
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
}
