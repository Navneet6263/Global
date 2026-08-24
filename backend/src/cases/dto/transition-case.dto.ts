import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { CaseStatuses } from "../case.constants";

export class TransitionCaseDto {
  @IsIn(CaseStatuses)
  status!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(3, 500)
  reason?: string;
}
