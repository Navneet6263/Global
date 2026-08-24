import { IsString, Length, Matches } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @Length(8, 200)
  currentPassword!: string;

  @IsString()
  @Length(14, 200)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: "newPassword must include upper, lower, number, and symbol",
  })
  newPassword!: string;
}
