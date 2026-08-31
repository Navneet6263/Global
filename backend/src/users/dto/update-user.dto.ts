import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UpdateUserDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsIn(["ACTIVE", "SUSPENDED"]) status?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  roleCodes?: string[];
  @IsOptional() @IsBoolean() additionalAccessConfirmed?: boolean;
}
