import { IsBoolean, IsInt, Min } from "class-validator";

export class UpdateAccessPolicyDto {
  @IsBoolean()
  opsUserCreationEnabled!: boolean;

  @IsInt()
  @Min(1)
  version!: number;
}
