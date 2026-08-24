import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from "class-validator";

export class CreateTaskDto {
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  instructions?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
