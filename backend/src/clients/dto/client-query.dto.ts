import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { PageQueryDto } from "../../common/dto/page-query.dto";

export const ClientDirectoryStatuses = [
  "ACTIVE",
  "ONBOARDING",
  "SUSPENDED",
] as const;

export class ClientQueryDto extends PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsIn(ClientDirectoryStatuses)
  status?: (typeof ClientDirectoryStatuses)[number];
}
