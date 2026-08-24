import { IsIn, IsOptional, IsString, Length } from "class-validator";

export class ListInvoicesDto {
  @IsOptional()
  @IsIn(["ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED", "OVERDUE"])
  status?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  search?: string;
}
