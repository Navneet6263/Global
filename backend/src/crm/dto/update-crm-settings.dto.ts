import { Type } from "class-transformer";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { CRM_LEAD_SOURCES } from "../crm-settings.constants";

export class CrmStageProbabilitiesDto {
  @IsInt()
  @Min(0)
  @Max(100)
  NEW!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  QUALIFIED!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  PROPOSAL!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  NEGOTIATION!: number;

  @IsInt()
  @Min(100)
  @Max(100)
  WON!: number;

  @IsInt()
  @Min(0)
  @Max(0)
  LOST!: number;
}

export class UpdateCrmSettingsDto {
  @IsInt()
  @Min(0)
  version!: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => CrmStageProbabilitiesDto)
  stageProbabilities!: CrmStageProbabilitiesDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(CRM_LEAD_SOURCES, { each: true })
  leadSources!: string[];
}
