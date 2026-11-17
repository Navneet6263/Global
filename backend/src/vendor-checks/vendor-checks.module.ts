import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { VendorCheckReminderService } from "./vendor-check-reminder.service";
import { VendorChecksController } from "./vendor-checks.controller";
import { VendorChecksService } from "./vendor-checks.service";
import {
  VendorQueueController,
  VendorRatesController,
} from "./vendor-queue.controller";
import { VendorQueueService } from "./vendor-queue.service";
import { VendorRatesService } from "./vendor-rates.service";
import { VendorWorkController } from "./vendor-work.controller";
import { VendorWorkService } from "./vendor-work.service";

/**
 * Vendor / field work on whole checks: internal assignment, the open vendor queue,
 * vendor rates and the vendor workspace.
 */
@Module({
  imports: [DocumentsModule],
  controllers: [
    VendorChecksController,
    VendorWorkController,
    VendorQueueController,
    VendorRatesController,
  ],
  providers: [
    VendorChecksService,
    VendorWorkService,
    VendorQueueService,
    VendorRatesService,
    VendorCheckReminderService,
  ],
})
export class VendorChecksModule {}
