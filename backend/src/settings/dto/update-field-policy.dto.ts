import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, Max, Min } from "class-validator";

export class UpdateFieldPolicyDto {
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(1000)
  defaultRadiusMeters!: number;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(500)
  maxAccuracyMeters!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  minimumPhotos!: number;

  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(3650)
  retentionDays!: number;

  @IsBoolean()
  requireCheckout!: boolean;

  @IsIn(["BLOCK", "SUPERVISOR_APPROVAL", "ALLOW_AND_FLAG"])
  outsideGeofencePolicy!: string;

  @IsInt()
  @Min(1)
  version!: number;
}
