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
