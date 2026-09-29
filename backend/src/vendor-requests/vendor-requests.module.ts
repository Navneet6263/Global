import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { AssignVendorService } from "./services/assign-vendor.service";
import { DecideVendorRequestService } from "./services/decide-vendor-request.service";
import { ReassignVendorService } from "./services/reassign-vendor.service";
import { RequestReuploadService } from "./services/request-reupload.service";
import { SpocVendorMonitorService } from "./services/spoc-vendor-monitor.service";
import { VendorInboxService } from "./services/vendor-inbox.service";
import { SpocVendorsController } from "./spoc-vendors.controller";
import { SpocVendorsRepository } from "./spoc-vendors.repository";
import { VendorAssignmentsRepository } from "./vendor-assignments.repository";
import { VendorRequestsController } from "./vendor-requests.controller";
import { VendorRequestsRepository } from "./vendor-requests.repository";

@Module({
  imports: [DocumentsModule],
  controllers: [SpocVendorsController, VendorRequestsController],
  providers: [
    SpocVendorsRepository,
    VendorAssignmentsRepository,
    VendorRequestsRepository,
    SpocVendorMonitorService,
    AssignVendorService,
    ReassignVendorService,
    RequestReuploadService,
    VendorInboxService,
    DecideVendorRequestService,
  ],
})
export class VendorRequestsModule {}
