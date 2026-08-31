import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";

export class ReassignTaskDto {
  @IsUUID()
  assigneeId!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  instructions?: string;
}
