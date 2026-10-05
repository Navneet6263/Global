import { IsBoolean, IsOptional } from "class-validator";

export class IssueCandidateAccessDto {
  @IsOptional()
  @IsBoolean()
  sendNotification?: boolean;
}
