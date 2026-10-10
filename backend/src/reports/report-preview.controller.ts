import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { ReportPreviewService } from "./report-preview.service";
import { ReportRegenerationService } from "./report-regeneration.service";
import { ReportsService } from "./reports.service";

export class RegenerateReportDto {
  @IsString() @Length(10, 500) reason!: string;
}

export class ReportPreviewQueryDto {
  @IsOptional() @IsIn(["client", "internal"]) audience?: "client" | "internal";
}

export class ReportDetailsDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Use a date like 2026-10-01" })
  joiningDate?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  clientProcess?: string | null;
}

/** Live report preview (draft) and the report header details. */
@Controller("cases/:caseId")
@RequireRoles(
  "PLATFORM_ADMIN",
  "OPS_MANAGER",
  "QA_REVIEWER",
  "SPOC_RM",
  "VERIFIER",
  "DATA_ENTRY",
)
export class ReportPreviewController {
  constructor(
    private readonly preview: ReportPreviewService,
    private readonly regeneration: ReportRegenerationService,
    private readonly reports: ReportsService,
  ) {}

  /** Rebuild an approved report's PDF as a new version (missing file or new layout). */
  @Post("reports/:reportId/regenerate")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  regenerateReport(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("reportId", ParseUUIDPipe) reportId: string,
    @Body() body: RegenerateReportDto,
  ) {
    return this.regeneration.regenerate(actor, caseId, reportId, body.reason);
  }

  /** The released report's latest PDF for the case team (same release rules as clients). */
  @Get("reports/:reportId/pdf")
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM", "QA_REVIEWER")
  releasedReportPdf(
    @CurrentActor() actor: Actor,
    @Param("reportId", ParseUUIDPipe) reportId: string,
  ) {
    return this.reports.download(actor, reportId);
  }

  @Get("report-preview")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  reportPreview(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Query() query: ReportPreviewQueryDto,
  ) {
    return this.preview.render(actor, caseId, query.audience ?? "client");
  }

  /** The report as structured data for the on-screen view. */
  @Get("report-view")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  reportView(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Query() query: ReportPreviewQueryDto,
  ) {
    return this.preview.view(actor, caseId, query.audience ?? "client");
  }

  @Get("report-details")
  reportDetails(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
  ) {
    return this.preview.details(actor, caseId);
  }

  @Patch("report-details")
  updateReportDetails(
    @CurrentActor() actor: Actor,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() body: ReportDetailsDto,
  ) {
    return this.preview.updateDetails(actor, caseId, body);
  }
}
