import { IsString, Length, Matches } from "class-validator";

export class ResetUserPasswordDto {
  @IsString()
  @Length(14, 200)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
  temporaryPassword!: string;
}
