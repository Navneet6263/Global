import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import {
  VendorAssignmentStatuses,
  VendorDecisions,
  VendorDocumentStatuses,
  VENDOR_TEXT_MAX,
  type VendorAssignmentStatus,
  type VendorDecision,
  type VendorDocumentStatus,
} from "./services/vendor-rules";

export class VendorPageQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100_000)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class SpocVendorClientQueryDto extends VendorPageQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

export class SpocVendorDocumentQueryDto extends VendorPageQueryDto {
  @IsOptional()
  @IsIn(VendorDocumentStatuses)
  vendorStatus?: VendorDocumentStatus;
}

export class AssignVendorDto {
  @IsUUID() vendorId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(VENDOR_TEXT_MAX)
  note?: string;
}

export class ReassignVendorDto {
  @IsUUID() vendorId!: string;
  /** How the previous rejection was resolved; trimmed and length-checked by the service. */
  @IsString() @MaxLength(VENDOR_TEXT_MAX) resolutionNote!: string;
  @IsInt() @Min(1) version!: number;
}

export class RequestReuploadDto {
  /** Shown to the candidate on their existing link; trimmed and length-checked by the service. */
  @IsString() @MaxLength(VENDOR_TEXT_MAX) message!: string;
  /** Document.version the SPOC-RM is looking at (optimistic check). */
  @IsInt() @Min(1) version!: number;
}

export class VendorRequestQueryDto extends VendorPageQueryDto {
  @IsOptional()
  @IsIn(VendorAssignmentStatuses)
  status?: VendorAssignmentStatus;
}

export class VendorDecisionDto {
  @IsIn(VendorDecisions) decision!: VendorDecision;

  /** Mandatory for REJECTED (checked again after trimming); optional remark for APPROVED. */
  @ValidateIf(
    (dto: VendorDecisionDto) =>
      dto.decision === "REJECTED" || dto.reason !== undefined,
  )
  @IsString()
  @MaxLength(VENDOR_TEXT_MAX)
  reason?: string;

  @IsInt() @Min(1) version!: number;
}
