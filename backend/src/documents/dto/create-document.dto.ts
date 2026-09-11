import { IsIn, IsOptional, Matches } from "class-validator";

export class CreateDocumentDto {
  @IsIn([
    "AADHAAR",
    "PAN",
    "PASSPORT",
    "DRIVING_LICENCE",
    "ADDRESS_PROOF",
    "EDUCATION_CERTIFICATE",
    "EMPLOYMENT_PROOF",
    "OTHER",
  ])
  type!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expiresAt?: string;
}
