import { Module } from "@nestjs/common";
import { ContentInspectionService } from "./content-inspection.service";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { LocalObjectStorageService } from "./local-object-storage.service";

@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    ContentInspectionService,
    LocalObjectStorageService,
  ],
  exports: [
    DocumentsService,
    LocalObjectStorageService,
    ContentInspectionService,
  ],
})
export class DocumentsModule {}
