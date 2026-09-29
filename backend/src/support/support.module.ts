import { Module } from "@nestjs/common";
import { ClientSupportController } from "./client-support.controller";
import { CreateSupportRequestService } from "./services/create-support-request.service";
import { RequesterSupportRequestsService } from "./services/requester-support-requests.service";
import { SupportDirectoryService } from "./services/support-directory.service";
import { SupportEmployeeDetailService } from "./services/support-employee-detail.service";
import { SupportInboxService } from "./services/support-inbox.service";
import { UpdateSupportRequestService } from "./services/update-support-request.service";
import { SupportDirectoryRepository } from "./support-directory.repository";
import { SupportController } from "./support.controller";
import { SupportRepository } from "./support.repository";

@Module({
  controllers: [SupportController, ClientSupportController],
  providers: [
    SupportRepository,
    SupportDirectoryRepository,
    CreateSupportRequestService,
    RequesterSupportRequestsService,
    SupportInboxService,
    UpdateSupportRequestService,
    SupportDirectoryService,
    SupportEmployeeDetailService,
  ],
  // The candidate portal raises and lists a candidate's own requests.
  exports: [CreateSupportRequestService, RequesterSupportRequestsService],
})
export class SupportModule {}
