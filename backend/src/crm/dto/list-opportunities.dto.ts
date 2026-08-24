import { IsIn, IsOptional, IsString, Length } from "class-validator";
import { OpportunityStages } from "./create-opportunity.dto";

export class ListOpportunitiesDto {
  @IsOptional()
  @IsIn(OpportunityStages)
  stage?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  search?: string;
}
