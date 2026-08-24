import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import { CheckTypes } from "../../cases/case.constants";

export class CreateServicePackageDto {
  @IsString()
  @Length(2, 40)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsIn(CheckTypes, { each: true })
  checks!: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999)
  price?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8760)
  tatHours!: number;
}
