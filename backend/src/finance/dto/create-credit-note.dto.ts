import { Type } from "class-transformer";
import { IsInt, IsNumber, IsString, Length, Min } from "class-validator";

export class CreateCreditNoteDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @Length(5, 500)
  reason!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
