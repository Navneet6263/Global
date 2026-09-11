import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import {
  incidentSeverities,
  privacyKinds,
  privacyStatuses,
  requestTypes,
} from "./privacy-policy";

export class PrivacyQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 12;
  @IsOptional()
  @IsIn(privacyKinds)
  kind?: string;
  @IsOptional()
  @IsIn(privacyStatuses)
  status?: string;
  @IsOptional()
  @IsString()
  @Length(1, 160)
  search?: string;
}

export class CreatePrivacyRecordDto {
  @IsIn(privacyKinds)
  kind!: string;
  @IsString()
  @Length(5, 160)
  title!: string;
  @IsString()
  @Length(10, 2000)
  description!: string;
  @IsOptional()
  @IsString()
  @Length(3, 200)
  subjectReference?: string;
  @IsOptional()
  @IsIn(requestTypes)
  requestType?: string;
  @IsOptional()
  @IsIn(incidentSeverities)
  severity?: string;
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class UpdatePrivacyRecordDto {
  @IsInt()
  @Min(1)
  version!: number;
  @IsIn(privacyStatuses)
  status!: string;
  @IsString()
  @Length(10, 2000)
  note!: string;
  @IsOptional()
  @IsString()
  @Length(3, 300)
  evidenceReference?: string;
}
