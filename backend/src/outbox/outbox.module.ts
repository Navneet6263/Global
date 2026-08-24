import { Module } from "@nestjs/common";
import { ReportsModule } from "../reports/reports.module";
import { DocumentsModule } from "../documents/documents.module";
import { OutboxWorkerService } from "./outbox-worker.service";
import { RetentionWorkerService } from "./retention-worker.service";

@Module({
  imports: [ReportsModule, DocumentsModule],
  providers: [OutboxWorkerService, RetentionWorkerService],
})
export class OutboxModule {}
