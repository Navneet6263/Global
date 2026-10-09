import { Module } from "@nestjs/common";
import { ClientsController } from "./clients.controller";
import { ClientAccountController } from "./client-account.controller";
import { ClientReviewController } from "./client-review.controller";
import { ClientReviewService } from "./client-review.service";
import { ClientsService } from "./clients.service";
import { CasesModule } from "../cases/cases.module";
import { ClientIntakeController } from "./client-intake.controller";
import { ClientCommercialController } from "./client-commercial.controller";
import { ClientCommercialService } from "./client-commercial.service";
import { ClientAgreementFilesService } from "./client-agreement-files.service";
import { ClientAgreementFilesController } from "./client-agreement-files.controller";
import { DocumentsModule } from "../documents/documents.module";

@Module({
  imports: [CasesModule, DocumentsModule],
  controllers: [
    ClientsController,
    ClientIntakeController,
    ClientCommercialController,
    ClientAgreementFilesController,
    ClientAccountController,
    ClientReviewController,
  ],
  providers: [
    ClientsService,
    ClientCommercialService,
    ClientAgreementFilesService,
    ClientReviewService,
  ],
})
export class ClientsModule {}
