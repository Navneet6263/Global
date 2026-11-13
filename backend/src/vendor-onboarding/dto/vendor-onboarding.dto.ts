import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export const VENDOR_BUSINESS_TYPES = [
  "PRIVATE_LIMITED",
  "LLP",
  "PARTNERSHIP",
  "PROPRIETORSHIP",
] as const;

export type VendorBusinessType = (typeof VENDOR_BUSINESS_TYPES)[number];

export const VENDOR_DOCUMENT_TYPES = [
  "COMPANY_PAN",
  "GST_CERTIFICATE",
  "BUSINESS_REGISTRATION",
] as const;

export type VendorDocumentType = (typeof VENDOR_DOCUMENT_TYPES)[number];

export class VendorSignupStartDto {
  @IsEmail({}, { message: "Enter a valid email address" })
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: "Full name is required" })
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: "Business name is required" })
  @MaxLength(180)
  companyName!: string;

  @IsOptional()
  @IsEnum(VENDOR_BUSINESS_TYPES, {
    message: "Select a valid business type (Private Limited, LLP, Partnership, Proprietorship)",
  })
  businessType?: VendorBusinessType = "PRIVATE_LIMITED";

  @IsOptional()
  @IsString()
  @MaxLength(24)
  phone?: string;

  @IsBoolean()
  @Equals(true, { message: "You must confirm you are an authorized signatory for this business" })
  isAuthorisedSignatory!: boolean;

  @IsBoolean()
  @Equals(true, { message: "You must accept the terms of service and privacy policy" })
  acceptTerms!: boolean;
}

export class VendorSignupVerifyDto {
  @IsUUID("4", { message: "Invalid sign-up challenge reference" })
  signupId!: string;

  @IsString()
  @IsNotEmpty({ message: "Enter the 6-digit confirmation code" })
  @MaxLength(6)
  otp!: string;
}

export class VendorSignupResendDto {
  @IsUUID("4", { message: "Invalid sign-up challenge reference" })
  signupId!: string;
}

export class VendorDocumentUploadQueryDto {
  @IsEnum(VENDOR_DOCUMENT_TYPES, {
    message: "Document type must be COMPANY_PAN, GST_CERTIFICATE, or BUSINESS_REGISTRATION",
  })
  documentType!: VendorDocumentType;
}

export class VendorProfileUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  operatingAddress?: string;
}

export class VendorDocumentReviewDto {
  @IsEnum(["ACCEPT", "REJECT"], { message: "Decision must be ACCEPT or REJECT" })
  decision!: "ACCEPT" | "REJECT";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
}

export class VendorRejectDto {
  @IsString()
  @IsNotEmpty({ message: "Please provide a rejection reason" })
  @MaxLength(1000)
  rejectionReason!: string;
}

export class VendorOnboardingQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
