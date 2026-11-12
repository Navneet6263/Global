import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export class ResolveClarificationDto {
  @IsOptional()
  @IsString()
  @Length(2, 2000)
  note?: string;

  /**
   * Team Leader shortcut: also accept the documents the candidate uploaded in reply,
   * with the note as the review note (one comment, then the case resumes).
   */
  @IsOptional()
  @IsBoolean()
  acceptDocuments?: boolean;
}
