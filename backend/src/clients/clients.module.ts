import { Module } from "@nestjs/common";
import { ClientsController } from "./clients.controller";
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
  ],
  providers: [
    ClientsService,
    ClientCommercialService,
    ClientAgreementFilesService,
  ],
})
export class ClientsModule {}
