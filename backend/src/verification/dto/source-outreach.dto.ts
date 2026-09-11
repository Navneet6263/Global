import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class SourceOutreachDto {
  @IsInt() @Min(1) version!: number;
  @IsIn(["EMAIL", "PHONE", "PORTAL", "IN_PERSON", "OTHER"]) channel!: string;
  @IsIn(["NO_RESPONSE", "CONTACTED", "INFORMATION_REQUESTED", "DECLINED"])
  outcome!: string;
  @IsString() @Length(10, 1500) notes!: string;
  @IsDateString() occurredAt!: string;
  @IsOptional() @IsDateString() nextFollowUpAt?: string;
}

export class OutreachQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(30) pageSize = 8;
}
