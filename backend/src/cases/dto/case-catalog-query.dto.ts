import { IsOptional, IsUUID } from "class-validator";

export class CaseCatalogQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;
}
