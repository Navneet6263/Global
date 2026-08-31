import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ContentInspectionService } from "../documents/content-inspection.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";

@Injectable()
export class DependencyHealthService {
  private validUntil = 0;
  private inFlight?: Promise<{ storage: string; malwareScanner: string; notifications: string }>;

  constructor(
    private readonly storage: LocalObjectStorageService,
    private readonly inspection: ContentInspectionService,
    private readonly config: ConfigService,
  ) {}

  probe() {
    if (Date.now() < this.validUntil && this.inFlight) return this.inFlight;
    this.inFlight = this.run();
    return this.inFlight;
  }

  private async run() {
    await this.storage.probe();
    await this.inspection.probe();
    const healthUrl = this.config.get<string>("NOTIFICATION_HEALTH_URL");
    if (healthUrl) {
      const response = await fetch(healthUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        throw new Error(`Notification health probe returned HTTP ${response.status}`);
      }
    }
    this.validUntil = Date.now() + 60_000;
    return {
      storage: "up",
      malwareScanner: this.config.get<string>("CLAMAV_HOST") ? "up" : "optional",
      notifications: healthUrl ? "up" : "optional",
    };
  }
}
