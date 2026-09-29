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
} from "class-validator";

export class UpdateUserDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsIn(["ACTIVE", "SUSPENDED"]) status?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsString({ each: true })
  roleCodes?: string[];
  @IsOptional() @IsBoolean() additionalAccessConfirmed?: boolean;
  /** SPOC-RM only: replaces the client workspaces it may monitor (at least one). */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  spocClientIds?: string[];
}
