import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { PageQueryDto } from "../../common/dto/page-query.dto";

export const SalesActivityFilters = [
  "CALL",
  "EMAIL",
  "MEETING",
  "NOTE",
  "FOLLOW_UP",
  "STAGE_CHANGE",
  "CREATED",
  "WON",
  "LOST",
] as const;

export class ListSalesActivitiesDto extends PageQueryDto {
  @IsOptional()
  @IsIn(SalesActivityFilters)
  type?: string;

  @IsOptional()
  @IsUUID()
  owner?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100_000)
  page = 1;
}
