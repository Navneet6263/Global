import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
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

export class BulkAssignmentItemDto {
  @IsUUID()
  checkId!: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class BulkAssignTasksDto {
  @IsUUID()
  assigneeId!: string;

  @IsIn(["ASSIGN", "REASSIGN"])
  mode!: "ASSIGN" | "REASSIGN";

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((item: BulkAssignmentItemDto | null) => item?.checkId)
  @ValidateNested({ each: true })
  @Type(() => BulkAssignmentItemDto)
  items!: BulkAssignmentItemDto[];

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  instructions?: string;
}
