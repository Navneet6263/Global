import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";

export class ReviewDocumentDto {
  @IsInt() @Min(1) version!: number;
  @IsInt() @Min(1) documentVersion!: number;
  @IsIn(["VERIFIED", "REJECTED", "REUPLOAD_REQUIRED"]) decision!: string;
  @IsString() @Length(5, 2000) note!: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}
