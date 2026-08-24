import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from "class-validator";

export class CreateClarificationDto {
  @IsOptional()
  @IsUUID()
  checkId?: string;

  @IsString()
  @Length(3, 180)
  subject!: string;

  @IsString()
  @Length(3, 5000)
  message!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
