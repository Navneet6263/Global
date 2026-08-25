import {
  ArrayMaxSize,
  ArrayMinSize,
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
  @ArrayMinSize(5)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  checklist!: string[];

  @IsString()
  @Length(10, 2000)
  notes!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  reworkCheckIds: string[] = [];
}
