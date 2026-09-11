import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
export const sharingCategories = [
  "IDENTITY",
  "EDUCATION",
  "EMPLOYMENT",
  "ADDRESS",
  "BUSINESS_REGISTRATION",
  "VERIFICATION_OUTCOMES",
] as const;
export class CreateVendorSharingDto {
  @IsString() @Length(2, 160) recipient!: string;
  @IsString() @Length(10, 1000) purpose!: string;
  @IsString() @Length(3, 300) agreementReference!: string;
  @IsString() @Length(3, 200) scopeReference!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsIn(sharingCategories, { each: true })
  categories!: string[];
  @IsDateString() expiresAt!: string;
}
export class VendorSharingQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @IsOptional() @IsString() @Length(1, 160) search?: string;
}
export class VendorSharingDecisionDto {
  @IsInt() @Min(1) version!: number;
  @IsIn(["AUTHORISED", "REJECTED", "REVOKED"]) status!: string;
  @IsString() @Length(10, 1000) reason!: string;
}
