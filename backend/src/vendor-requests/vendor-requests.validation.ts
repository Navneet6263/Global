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
import { UserIdentityDto } from "../users/dto/user-identity.dto";

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

/**
 * A Main Vendor's new team login: exactly the identity fields and validators of Admin
 * user creation (shared base class). Role, branch and client cannot be sent
 * (forbidNonWhitelisted); the role is always VENDOR.
 */
export class CreateVendorTeamUserDto extends UserIdentityDto {}

export class SetVendorTeamUserStatusDto {
  @IsIn(["ACTIVE", "SUSPENDED"]) status!: "ACTIVE" | "SUSPENDED";
  @IsInt() @Min(1) version!: number;
}

export class DelegateVendorRequestDto {
  /** Team user to hand the request to; null or omitted means the Main Vendor keeps it. */
  @IsOptional() @IsUUID() handlerId?: string | null;
  @IsInt() @Min(1) version!: number;
}

export class VendorLogQueryDto {
  @IsOptional() @IsUUID() cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  /** Only the activity of one request. */
  @IsOptional() @IsUUID() requestId?: string;
}

export class ReportModeQueryDto {
  @IsOptional() @IsIn(["preview", "download"]) mode: "preview" | "download" =
    "download";
}
