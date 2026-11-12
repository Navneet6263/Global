import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { CurrentActor, RequireRoles } from "../common/auth/auth.decorators";
import { BulkDataEntryService } from "./bulk-data-entry.service";
import { BulkAssignDataEntryDto } from "./dto/bulk-data-entry.dto";

/**
 * Bulk intake endpoints for the SPOC-RM Work Queue, kept separate from WorkflowController
 * to preserve compact single-responsibility controllers.
 */
@Controller("workflow")
export class WorkflowBulkController {
  constructor(private readonly bulkDataEntry: BulkDataEntryService) {}

  @Post("cases/bulk-data-entry")
  @HttpCode(HttpStatus.OK)
  @RequireRoles("PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM", "DATA_ENTRY")
  bulkAssignDataEntry(
    @CurrentActor() actor: Actor,
    @Body() input: BulkAssignDataEntryDto,
  ) {
    return this.bulkDataEntry.assignMany(actor, input);
  }
}
