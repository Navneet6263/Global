import { Module } from "@nestjs/common";
import { PrivacyController } from "./privacy.controller";
import { PrivacyQueryService } from "./privacy-query.service";
import { PrivacyService } from "./privacy.service";
import { RetentionPreviewController } from "./retention-preview.controller";
import { VendorSharingController } from "./vendor-sharing.controller";

@Module({
  controllers: [
    PrivacyController,
    RetentionPreviewController,
    VendorSharingController,
  ],
  providers: [PrivacyQueryService, PrivacyService],
})
export class PrivacyModule {}
