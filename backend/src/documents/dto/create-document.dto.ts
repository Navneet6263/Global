import { IsIn } from "class-validator";

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
}
