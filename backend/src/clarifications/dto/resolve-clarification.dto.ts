import { IsOptional, IsString, Length } from "class-validator";

export class ResolveClarificationDto {
  @IsOptional()
  @IsString()
  @Length(2, 2000)
  note?: string;
}
