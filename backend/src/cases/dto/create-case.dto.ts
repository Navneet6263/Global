import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from "class-validator";
import {
  INDIAN_MOBILE_MESSAGE,
  INDIAN_MOBILE_PATTERN,
  normalizeIndianMobile,
} from "../../common/validation/indian-mobile";
import { CheckTypes } from "../case.constants";

export class CreateCaseDto {
  @IsUUID()
  clientId!: string;

  @IsString()
  @Length(2, 160)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeIndianMobile(value))
  @Matches(INDIAN_MOBILE_PATTERN, { message: `phone ${INDIAN_MOBILE_MESSAGE}` })
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  employeeCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  externalRef?: string;

  @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"])
  priority: string = "NORMAL";

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @IsIn(CheckTypes, { each: true })
  checks!: string[];
}
