import { IsString, Length } from "class-validator";

export class RespondClarificationDto {
  @IsString()
  @Length(2, 5000)
  message!: string;
}
