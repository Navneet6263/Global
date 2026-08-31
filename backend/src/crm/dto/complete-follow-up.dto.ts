import { IsInt, IsOptional, IsString, Length, Min } from "class-validator";

export class CompleteFollowUpDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(2, 1000)
  notes?: string;
}
