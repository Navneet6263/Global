import { Type } from "class-transformer";
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from "class-validator";

export class CaseServiceDetailsDto {
  @IsOptional()
  @IsString()
  @Length(2, 180)
  organisationName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  registrationNumber?: string;

  @IsOptional()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
  gstin?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2000)
  conflictOfInterest?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2000)
  directorships?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2000)
  declaration?: string;

  @IsOptional()
  @IsString()
  @Length(2, 1000)
  referenceContacts?: string;
}

export class CaseServiceInputDto {
  @IsUUID()
  servicePackageId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CaseServiceDetailsDto)
  details?: CaseServiceDetailsDto;
}
