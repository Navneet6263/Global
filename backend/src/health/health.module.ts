import { Global, Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { RuntimeHealthService } from "./runtime-health.service";
import { DependencyHealthService } from "./dependency-health.service";
import { DocumentsModule } from "../documents/documents.module";

@Global()
@Module({
  imports: [DocumentsModule],
  controllers: [HealthController],
  providers: [RuntimeHealthService, DependencyHealthService],
  exports: [RuntimeHealthService],
})
export class HealthModule {}
