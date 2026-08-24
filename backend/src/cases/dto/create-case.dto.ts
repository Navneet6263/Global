import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Length,
} from "class-validator";
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
  @IsPhoneNumber()
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
