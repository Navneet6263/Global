import {
  IsEmail,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class CreateClientDto {
  @IsString()
  @Length(2, 32)
  code!: string;

  @IsString()
  @Length(2, 180)
  legalName!: string;

  @IsString()
  @Length(2, 120)
  displayName!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  contactName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsPhoneNumber()
  contactPhone?: string;

  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(720)
  slaHours = 72;
}
