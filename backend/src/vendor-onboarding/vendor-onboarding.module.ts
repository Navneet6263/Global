import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DocumentsModule } from "../documents/documents.module";
import { ApprovedVendorGuard } from "./guards/approved-vendor.guard";
import { OpsVendorOnboardingController } from "./ops-vendor-onboarding.controller";
import { VendorOnboardingOpsService } from "./vendor-onboarding-ops.service";
import { VendorOnboardingController } from "./vendor-onboarding.controller";
import { VendorOnboardingService } from "./vendor-onboarding.service";
import { VendorSignupController } from "./vendor-signup.controller";
import { VendorSignupService } from "./vendor-signup.service";

@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [
    VendorSignupController,
    VendorOnboardingController,
    OpsVendorOnboardingController,
  ],
  providers: [
    VendorSignupService,
    VendorOnboardingService,
    VendorOnboardingOpsService,
    ApprovedVendorGuard,
  ],
  exports: [
    VendorSignupService,
    VendorOnboardingService,
    VendorOnboardingOpsService,
    ApprovedVendorGuard,
  ],
})
export class VendorOnboardingModule {}
