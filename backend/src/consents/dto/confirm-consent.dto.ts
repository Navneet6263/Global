import { IsString, Matches } from "class-validator";

export class ConfirmConsentDto {
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}
