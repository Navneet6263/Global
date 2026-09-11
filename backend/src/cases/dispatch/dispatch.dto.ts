import { Type, Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class DispatchPreviewDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.split(",") : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  caseIds!: string[];
}

export class DispatchAllocationDto {
  @IsUUID()
  checkId!: string;

  @IsUUID()
  assigneeId!: string;

  @IsInt()
  @Min(1)
  checkVersion!: number;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class DispatchCommitDto {
  @IsUUID()
  operationId!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((item: DispatchAllocationDto) => item.checkId)
  @ValidateNested({ each: true })
  @Type(() => DispatchAllocationDto)
  allocations!: DispatchAllocationDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}
