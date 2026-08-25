import { IsString, Length } from "class-validator";

export class RenameSessionDto {
  @IsString()
  @Length(2, 80)
  name!: string;
}
