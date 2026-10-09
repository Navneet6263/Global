import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
import { ONBOARDING_DOCUMENT_TYPES } from "../onboarding-checklist";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
const upper = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toUpperCase() : value;

export class OnboardingCompanyDto {
  @IsInt() @Min(1) version!: number;
  @Transform(trim) @IsString() @Length(2, 180) legalName!: string;
  @Transform(trim) @IsString() @Length(2, 120) displayName!: string;
  @IsOptional()
  @Transform(upper)
  @Matches(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/, {
    message: "GSTIN must be a valid 15-character GST number",
  })
  gstin?: string;
  @IsOptional()
  @Transform(upper)
  @Matches(/^$|^[A-Z]{5}[0-9]{4}[A-Z]$/, {
    message: "PAN must be 10 characters, e.g. ABCDE1234F",
  })
  pan?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 500)
  billingAddress?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 120)
  contactName?: string;
  @IsOptional()
  @Transform(trim)
  @Matches(/^$|^[+0-9 ()-]{7,24}$/)
  contactPhone?: string;
}

export class OnboardingDocumentParamsDto {
  @IsIn(ONBOARDING_DOCUMENT_TYPES) type!: string;
}

export class OnboardingUploadQueryDto {
  /** Signing date for signed contracts (AGREEMENT, DPA, NDA); defaults to today. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  signedOn?: string;
}

export class OnboardingSubmitDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 500) note?: string;
}

export class OnboardingQueryDto {
  @IsOptional()
  @IsIn(["ONBOARDING", "ACTIVE", "SUSPENDED", "ALL"])
  status?: string;
  @IsOptional()
  @IsIn(["ALL", "NEEDS_RM", "SUBMITTED", "IN_PROGRESS"])
  view?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 80) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(50) pageSize?: number;
}

export class OnboardingActivityQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(50) pageSize?: number;
  @IsOptional()
  @IsIn(["DOCUMENTS", "PRICING", "PEOPLE", "DECISIONS"])
  kind?: "DOCUMENTS" | "PRICING" | "PEOPLE" | "DECISIONS";
}

export class OnboardingReviewDto {
  @IsInt() @Min(1) version!: number;
  @IsIn(["APPROVED", "REJECTED"]) status!: string;
  @Transform(trim) @IsString() @Length(10, 1000) notes!: string;
  @IsBoolean() signaturesChecked!: boolean;
}

export class OnboardingRateDto {
  @IsUUID() servicePackageId!: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999)
  unitPrice!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) taxRate!: number;
  @IsOptional() @IsInt() @Min(4) @Max(720) tatHours?: number;
  @IsBoolean() active!: boolean;
}

export class OnboardingCommercialDto {
  @IsInt() @Min(1) version!: number;
  @Transform(trim) @IsString() @Length(2, 200) billingTerms!: string;
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OnboardingRateDto)
  packages!: OnboardingRateDto[];
}

export class OnboardingMessageDto {
  @Transform(trim) @IsString() @Length(5, 500) message!: string;
}

export class OnboardingDecisionDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 500) note?: string;
}

export class OnboardingRejectDto {
  @IsInt() @Min(1) version!: number;
  @Transform(trim) @IsString() @Length(10, 500) reason!: string;
}
