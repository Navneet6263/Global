import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class CompleteFieldVisitDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  accuracyMeters!: number;

  @IsDateString()
  capturedAt!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(12)
  @ArrayUnique()
  @IsIn(
    [
      "House / gate photo",
      "Name plate close-up",
      "Neighbour confirmation",
      "Executive selfie at site",
    ],
    { each: true },
  )
  checklist!: string[];

  @IsOptional()
  @IsString()
  @Length(2, 2000)
  remarks?: string;
}
