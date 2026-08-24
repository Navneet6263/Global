import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";

export class QaDecisionDto {
  @IsIn(["APPROVED", "REWORK"])
  decision!: string;

  @IsInt()
  @Min(1)
  caseVersion!: number;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  checklist!: string[];

  @IsOptional()
  @IsString()
  @Length(3, 2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  reworkCheckIds: string[] = [];
}
