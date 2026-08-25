import {
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  Max,
  Min,
} from "class-validator";

export class CheckInFieldVisitDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsNumber()
  @Min(0)
  @Max(10_000)
  accuracyMeters!: number;

  @IsDateString()
  capturedAt!: string;

  @IsInt()
  @Min(1)
  version!: number;
}
