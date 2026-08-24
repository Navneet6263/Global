import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";

export class ReviewFieldExceptionDto {
  @IsIn(["APPROVE", "RETRY"])
  decision!: "APPROVE" | "RETRY";

  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(2, 1000)
  note?: string;
}
