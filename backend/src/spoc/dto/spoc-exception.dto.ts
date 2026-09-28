import { IsIn } from "class-validator";
import {
  SpocExceptionCategories,
  type SpocExceptionCategory,
} from "../spoc-exceptions.service";
import { SpocPageQueryDto } from "./spoc-query.dto";

export class SpocExceptionQueryDto extends SpocPageQueryDto {
  @IsIn(SpocExceptionCategories)
  category: SpocExceptionCategory = "overdue";
}
