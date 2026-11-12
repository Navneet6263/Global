import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from "class-validator";

export class BulkDataEntryItemDto {
  @IsUUID()
  caseId!: string;

  @IsInt()
  @Min(1)
  version!: number;
}

export class BulkAssignDataEntryDto {
  @IsUUID()
  assigneeId!: string;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((item: BulkDataEntryItemDto | null) => item?.caseId)
  @ValidateNested({ each: true })
  @Type(() => BulkDataEntryItemDto)
  items!: BulkDataEntryItemDto[];
}
