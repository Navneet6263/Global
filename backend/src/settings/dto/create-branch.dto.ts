import { IsOptional, IsString, Length, Matches } from "class-validator";

export class CreateBranchDto {
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  city?: string;
}
