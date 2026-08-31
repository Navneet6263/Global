import { Injectable } from "@nestjs/common";

type WorkerName = "outbox" | "retention";
type WorkerState = {
  maxSilenceMs: number;
  registeredAt: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  lastOutcome?: "success" | "failure";
};

@Injectable()
export class RuntimeHealthService {
  private readonly workers = new Map<WorkerName, WorkerState>();

  register(name: WorkerName, maxSilenceMs: number) {
    this.workers.set(name, { maxSilenceMs, registeredAt: new Date() });
  }

  success(name: WorkerName) {
    const state = this.workers.get(name);
    if (!state) return;
    state.lastSuccessAt = new Date();
    state.lastOutcome = "success";
  }

  failure(name: WorkerName, error: unknown) {
    const state = this.workers.get(name);
    if (!state) return;
    state.lastFailureAt = new Date();
    state.lastOutcome = "failure";
    // Detailed errors belong in worker logs, never in the unauthenticated
    // readiness response where infrastructure details could be disclosed.
    void error;
  }

  snapshot(required: boolean) {
    const now = Date.now();
    const workers = Object.fromEntries(
      [...this.workers.entries()].map(([name, state]) => {
        const lastSuccess = state.lastSuccessAt?.getTime() ?? 0;
        const inStartupGrace = now - state.registeredAt.getTime() < 60_000;
        const fresh =
          inStartupGrace ||
          (lastSuccess > 0 && now - lastSuccess <= state.maxSilenceMs);
        return [
          name,
          {
            healthy: fresh && state.lastOutcome !== "failure",
            lastSuccessAt: state.lastSuccessAt?.toISOString() ?? null,
            lastFailureAt: state.lastFailureAt?.toISOString() ?? null,
          },
        ];
      }),
    );
    const healthy =
      !required ||
      (this.workers.size === 2 &&
        Object.values(workers).every((state) => state.healthy));
    return { healthy, workers };
  }
}
