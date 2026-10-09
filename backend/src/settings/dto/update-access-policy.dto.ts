import { IsBoolean, IsInt, IsOptional, Min } from "class-validator";

export class UpdateAccessPolicyDto {
  @IsBoolean()
  opsUserCreationEnabled!: boolean;

  /** Release reports after approval and bill monthly (false = wait for payment). */
  @IsOptional()
  @IsBoolean()
  releaseBeforePayment?: boolean;

  /** Branch (office) scoping of cases and users. */
  @IsOptional()
  @IsBoolean()
  branchScopingEnabled?: boolean;

  @IsInt()
  @Min(1)
  version!: number;
}
