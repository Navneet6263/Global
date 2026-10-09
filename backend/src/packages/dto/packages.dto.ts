import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { CheckTypes } from "../../cases/case.constants";
import { RequiredDocumentTypes } from "../../cases/case-service-plan";
import { CreateServicePackageDto } from "../../settings/dto/create-service-package.dto";

/** A new package, plus the most an RM may discount it. */
export class CreatePackageDto extends CreateServicePackageDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  maxRmDiscountPercent: number = 0;

  /** Price of each check on its own, e.g. { EMPLOYMENT: 2500 }. */
  @IsOptional()
  @IsObject()
  checkPrices?: Record<string, number>;

  /** GST % on this package (default 18). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;
}

export class UpdatePackageDto {
  /** Optimistic lock: the package's updatedAt as last read. */
  @IsDateString()
  updatedAt!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  @IsIn(CheckTypes, { each: true })
  checks?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(RequiredDocumentTypes, { each: true })
  requiredDocuments?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8760)
  tatHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  maxRmDiscountPercent?: number;

  @IsOptional()
  @IsObject()
  checkPrices?: Record<string, number>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetDiscountDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
