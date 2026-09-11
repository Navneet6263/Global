import { Type, Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class ClientRateDto {
  @IsUUID() servicePackageId!: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999)
  unitPrice!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) taxRate!: number;
  @IsOptional() @IsInt() @Min(4) @Max(720) tatHours?: number;
  @IsBoolean() active!: boolean;
}

export class ClientAgreementDto {
  @IsIn(["AGREEMENT", "DPA", "CONFIDENTIALITY", "PROPOSAL"]) type!: string;
  @IsString() @Length(2, 500) reference!: string;
  @IsOptional() @IsDateString() signedAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class UpdateCommercialDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Matches(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/)
  gstin?: string;
  @IsOptional() @IsString() @Length(0, 500) billingAddress?: string;
  @IsOptional() @IsString() @Length(0, 200) billingTerms?: string;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ClientRateDto)
  packages!: ClientRateDto[];
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ClientAgreementDto)
  agreements!: ClientAgreementDto[];
}
