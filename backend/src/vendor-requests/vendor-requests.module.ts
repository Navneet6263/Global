import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { AssignVendorService } from "./services/assign-vendor.service";
import { UploadVendorReportService } from "./services/upload-vendor-report.service";
import { VendorActivityService } from "./services/vendor-activity.service";
import { VendorReportFileService } from "./services/vendor-report-file.service";
import { VendorActivityController } from "./vendor-activity.controller";
import { VendorReportsController } from "./vendor-reports.controller";
import { VendorReportsRepository } from "./vendor-reports.repository";
import { CreateVendorTeamUserService } from "./services/create-vendor-team-user.service";
import { DecideVendorRequestService } from "./services/decide-vendor-request.service";
import { DelegateVendorRequestService } from "./services/delegate-vendor-request.service";
import { ManageVendorTeamUserService } from "./services/manage-vendor-team-user.service";
import { ReassignVendorService } from "./services/reassign-vendor.service";
import { RequestReuploadService } from "./services/request-reupload.service";
import { SpocVendorMonitorService } from "./services/spoc-vendor-monitor.service";
import { VendorInboxService } from "./services/vendor-inbox.service";
import { VendorTeamService } from "./services/vendor-team.service";
import { SpocVendorsController } from "./spoc-vendors.controller";
import { SpocVendorsRepository } from "./spoc-vendors.repository";
import { VendorAssignmentsRepository } from "./vendor-assignments.repository";
import { VendorRequestsController } from "./vendor-requests.controller";
import { VendorRequestsRepository } from "./vendor-requests.repository";
import { VendorTeamController } from "./vendor-team.controller";
import { VendorTeamRepository } from "./vendor-team.repository";

@Module({
  imports: [DocumentsModule],
  controllers: [
    SpocVendorsController,
    VendorRequestsController,
    VendorTeamController,
    VendorReportsController,
    VendorActivityController,
  ],
  providers: [
    SpocVendorsRepository,
    VendorAssignmentsRepository,
    VendorRequestsRepository,
    VendorTeamRepository,
    VendorReportsRepository,
    UploadVendorReportService,
    VendorReportFileService,
    VendorActivityService,
    SpocVendorMonitorService,
    AssignVendorService,
    ReassignVendorService,
    RequestReuploadService,
    VendorInboxService,
    DecideVendorRequestService,
    DelegateVendorRequestService,
    VendorTeamService,
    CreateVendorTeamUserService,
    ManageVendorTeamUserService,
  ],
})
export class VendorRequestsModule {}
