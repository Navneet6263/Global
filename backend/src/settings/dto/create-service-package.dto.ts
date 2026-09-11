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
import {
  RequiredDocumentTypes,
  ServiceFamilies,
} from "../../cases/case-service-plan";

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
  @ArrayMaxSize(24)
  @IsIn(CheckTypes, { each: true })
  checks!: string[];

  @IsIn(ServiceFamilies)
  serviceFamily: string = "HIRECHECK";

  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(RequiredDocumentTypes, { each: true })
  requiredDocuments: string[] = [];

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
