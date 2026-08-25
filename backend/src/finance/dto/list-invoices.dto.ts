import { IsIn, IsOptional } from "class-validator";
import { PageQueryDto } from "../../common/dto/page-query.dto";

export class ListInvoicesDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED", "OVERDUE"])
  status?: string;
}
