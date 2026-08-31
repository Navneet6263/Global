import { Module } from "@nestjs/common";
import { ReportsModule } from "../reports/reports.module";
import { DocumentsModule } from "../documents/documents.module";
import { OutboxWorkerService } from "./outbox-worker.service";
import { RetentionWorkerService } from "./retention-worker.service";
import { OutboxClaimService } from "./outbox-claim.service";
import { DataHousekeepingService } from "./data-housekeeping.service";
import { ObjectDeletionRecoveryController } from "./object-deletion-recovery.controller";
import { ObjectDeletionRecoveryService } from "./object-deletion-recovery.service";

@Module({
  imports: [ReportsModule, DocumentsModule],
  controllers: [ObjectDeletionRecoveryController],
  providers: [
    OutboxClaimService,
    ObjectDeletionRecoveryService,
    OutboxWorkerService,
    RetentionWorkerService,
    DataHousekeepingService,
  ],
})
export class OutboxModule {}
