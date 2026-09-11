import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class MethodEvidenceVersionDto {
  @IsUUID()
  documentId!: string;
  @IsInt()
  @Min(1)
  version!: number;
}

export class CreateVerificationMethodDto {
  @IsIn(["DIGITAL", "MANUAL", "THIRD_PARTY"])
  method!: string;
  @IsOptional()
  @IsString()
  @Length(2, 160)
  provider?: string;
  @IsOptional()
  @IsString()
  @Length(2, 300)
  sourceContact?: string;
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class RespondVerificationMethodDto {
  @IsInt()
  @Min(1)
  version!: number;
  @IsIn(["CLEAR", "DISCREPANCY", "UNABLE_TO_VERIFY"])
  result!: string;
  @IsString()
  @Length(10, 2000)
  summary!: string;
  @IsOptional()
  @IsString()
  @Length(2, 180)
  reference?: string;
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  evidenceIds: string[] = [];
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MethodEvidenceVersionDto)
  evidenceVersions: MethodEvidenceVersionDto[] = [];
}
