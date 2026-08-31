import { Module } from "@nestjs/common";
import { ConsentIssuanceService } from "./consent-issuance.service";
import { ConsentsController } from "./consents.controller";
import { ConsentsService } from "./consents.service";

@Module({
  controllers: [ConsentsController],
  providers: [ConsentsService, ConsentIssuanceService],
  exports: [ConsentIssuanceService],
})
export class ConsentsModule {}
