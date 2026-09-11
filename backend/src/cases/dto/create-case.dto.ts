import { Transform, Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from "class-validator";
import { CaseServiceInputDto } from "./case-service-input.dto";
import {
  INDIAN_MOBILE_MESSAGE,
  INDIAN_MOBILE_PATTERN,
  normalizeIndianMobile,
} from "../../common/validation/indian-mobile";

export class CreateCaseDto {
  @IsUUID()
  clientId!: string;

  @IsString()
  @Length(2, 160)
  fullName!: string;

  @ValidateIf(
    (input: CreateCaseDto) => !input.phone || input.email !== undefined,
  )
  @IsEmail(
    {},
    { message: "A valid candidate email or mobile number is required" },
  )
  email?: string;

  @ValidateIf(
    (input: CreateCaseDto) => !input.email || input.phone !== undefined,
  )
  @Transform(({ value }) => normalizeIndianMobile(value))
  @Matches(INDIAN_MOBILE_PATTERN, {
    message: `A candidate email or phone ${INDIAN_MOBILE_MESSAGE}`,
  })
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

  @IsUUID()
  servicePackageId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => CaseServiceInputDto)
  services?: CaseServiceInputDto[];
}
