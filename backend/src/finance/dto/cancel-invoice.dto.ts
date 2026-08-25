import { IsInt, IsString, Length, Min } from "class-validator";

export class CancelInvoiceDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(5, 300)
  reason!: string;
}
