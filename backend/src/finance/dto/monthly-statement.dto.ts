import { IsOptional, IsUUID, Matches } from "class-validator";

export class MonthlyStatementDto {
  @Matches(/^20\d{2}-(0[1-9]|1[0-2])$/, {
    message: "month must use YYYY-MM format",
  })
  month!: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}
