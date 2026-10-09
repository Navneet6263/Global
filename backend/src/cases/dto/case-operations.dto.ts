import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";

export class EscalateCaseDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;
}

/** Company Admin escalation: a reason is required so the RM knows what to fix. */
export class ClientEscalateCaseDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(10, 500)
  reason!: string;
}

export class AssignCaseOwnerDto {
  @IsUUID()
  ownerId!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;
}
