import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";

export class ManagerReviewDto {
  @IsInt() @Min(1) caseVersion!: number;
  @IsIn(["APPROVED", "REWORK"]) decision!: "APPROVED" | "REWORK";
  @IsString() @Length(10, 2000) notes!: string;
  @IsOptional() @IsString() @Length(10, 2000) recommendation?: string;
  @IsOptional() @IsBoolean() highRiskAcknowledged?: boolean;
}

export class ReopenCaseDto {
  @IsInt() @Min(1) caseVersion!: number;
  @IsString() @Length(10, 2000) notes!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  checkIds!: string[];
}
