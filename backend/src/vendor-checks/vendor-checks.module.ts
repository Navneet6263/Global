import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { VendorCheckReminderService } from "./vendor-check-reminder.service";
import { VendorChecksController } from "./vendor-checks.controller";
import { VendorChecksService } from "./vendor-checks.service";
import { VendorWorkController } from "./vendor-work.controller";
import { VendorWorkService } from "./vendor-work.service";

/** Vendor / field work on whole checks (internal assignment + vendor workspace). */
@Module({
  imports: [DocumentsModule],
  controllers: [VendorChecksController, VendorWorkController],
  providers: [
    VendorChecksService,
    VendorWorkService,
    VendorCheckReminderService,
  ],
})
export class VendorChecksModule {}
