import { Type } from "class-transformer";
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
  ValidateNested,
} from "class-validator";

/** QA's comment on one document of the case: QA's verification of that document. */
export class QaDocumentCommentDto {
  @IsUUID()
  documentId!: string;

  @IsString()
  @Length(3, 500)
  comment!: string;
}

export class QaDecisionDto {
  @IsIn(["APPROVED", "REWORK"])
  decision!: string;

  @IsInt()
  @Min(1)
  caseVersion!: number;

  /** Older clients still send the checklist; it is no longer required. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  checklist: string[] = [];

  /** One comment per uploaded document; every one is needed to approve. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QaDocumentCommentDto)
  documentComments: QaDocumentCommentDto[] = [];

  @IsString()
  @Length(10, 2000)
  notes!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  reworkCheckIds: string[] = [];
}
