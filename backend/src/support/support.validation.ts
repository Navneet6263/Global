import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { CaseStatuses } from "../cases/case.constants";
import { SpocHolderRoles, type SpocHolderRole } from "../spoc/spoc-holder";
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_SUBJECT_MAX,
  SupportCaseStates,
  SupportRequestStatuses,
  SupportRequesterTypes,
  SupportUpdateStatuses,
  type SupportCaseState,
  type SupportRequestStatus,
  type SupportRequesterType,
  type SupportUpdateStatus,
} from "./services/support-rules";

const toBoolean = ({ value }: { value: unknown }) =>
  value === "true" ? true : value === "false" ? false : value;

export class SupportPageQueryDto {
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

export class SupportEmployeeQueryDto extends SupportPageQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsIn(SupportCaseStates)
  state?: SupportCaseState;

  @IsOptional()
  @IsIn(CaseStatuses)
  status?: string;

  @IsOptional()
  @IsIn(SpocHolderRoles)
  holderRole?: SpocHolderRole;
}

export class SupportRequestQueryDto extends SupportPageQueryDto {
  @IsOptional()
  @IsIn(SupportRequestStatuses)
  status?: SupportRequestStatus;

  @IsOptional()
  @IsIn(SupportRequesterTypes)
  requesterType?: SupportRequesterType;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  /** Only requests the signed-in agent has taken. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mine?: boolean;
}

export class UpdateSupportRequestDto {
  @IsIn(SupportUpdateStatuses) status!: SupportUpdateStatus;

  /** Reply shown to the requester; required (5+ characters) when resolving. */
  @IsOptional()
  @IsString()
  @MaxLength(SUPPORT_MESSAGE_MAX)
  note?: string;

  @IsInt() @Min(1) version!: number;
}

/** Raised from the candidate link or the Client Admin navbar; lengths re-checked after trimming. */
export class RaiseSupportRequestDto {
  @IsString() @MaxLength(SUPPORT_SUBJECT_MAX) subject!: string;
  @IsString() @MaxLength(SUPPORT_MESSAGE_MAX) message!: string;
}

export class ClientSupportRequestDto extends RaiseSupportRequestDto {
  /** Optional employee case this request is about; must belong to the Client Admin's client. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  caseNumber?: string;
}

export class MySupportRequestQueryDto {
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
  @Max(50)
  pageSize = 10;
}
