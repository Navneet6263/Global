import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { PageQueryDto } from "../../common/dto/page-query.dto";

export class QaRegisterQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @IsOptional()
  @IsIn(["all", "available", "mine", "corrections"])
  view: "all" | "available" | "mine" | "corrections" = "all";
}
