import { IsInt, Min } from "class-validator";

export class ClaimQaCaseDto {
  @IsInt()
  @Min(1)
  caseVersion!: number;
}
