import { Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { ServicePackagePolicyService } from "./service-package-policy.service";

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, ServicePackagePolicyService],
})
export class SettingsModule {}
