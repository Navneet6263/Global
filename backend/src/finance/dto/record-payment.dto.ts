import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class RecordPaymentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999_999)
  amount!: number;

  @IsIn(["BANK_TRANSFER", "UPI", "CHEQUE", "CARD", "OTHER"])
  method!: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  reference?: string;

  @IsDateString()
  receivedAt!: string;

  @IsInt()
  @Min(1)
  version!: number;
}
