import { IsIn, IsOptional } from "class-validator";
import { OpportunityStages } from "./create-opportunity.dto";
import { PageQueryDto } from "../../common/dto/page-query.dto";

export class ListOpportunitiesDto extends PageQueryDto {
  @IsOptional()
  @IsIn(OpportunityStages)
  stage?: string;
}
