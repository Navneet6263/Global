import { IsIn, IsOptional, IsUUID } from "class-validator";
import { PageQueryDto } from "../../common/dto/page-query.dto";
import { CaseStatuses } from "../case.constants";

export class CaseQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(CaseStatuses)
  status?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}
