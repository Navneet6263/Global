import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class ProposalLineDto {
  @IsUUID() packageId!: string;
  @IsInt() @Min(1) @Max(10000) quantity!: number;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000000)
  unitPrice!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) taxRate!: number;
}
export class CreateProposalDto {
  @IsInt() @Min(1) opportunityVersion!: number;
  @IsDateString() validUntil!: string;
  @IsString() @Length(10, 2000) terms!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProposalLineDto)
  lines!: ProposalLineDto[];
}
export class ProposalDecisionDto {
  @IsInt() @Min(1) version!: number;
  @IsIn(["APPROVED", "REJECTED", "SENT", "ACCEPTED", "DECLINED", "WITHDRAWN"])
  status!: string;
  @IsString() @Length(10, 1000) evidence!: string;
}
