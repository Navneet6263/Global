# Sapling Global release closure checklist

## Staging validation

- Re-run migration preflight/status/deployment verification against the isolated staging release database and restore-test its backup before promotion.
- Execute authenticated role-by-role workflows from case intake through consent, evidence, verification, clarification, QA, report and billing.
- Add database-backed tenant-isolation integration fixtures for every module and confirm public tokens cannot cross resources.
- Run Playwright on desktop and mobile profiles with real staging credentials, GPS/camera permissions and offline/online transitions.
- Verify notification-provider idempotency, OTP delivery, ClamAV rejection and S3/Azure object access policies.

## Operational validation

- Establish SQL and object-store backup schedules, prove restore, and record recovery time/recovery point results.
- Configure centralized PII-redacted logs and alerts for readiness, 5xx spikes, login lockouts, failed outbox events and retention failures.
- Load-test login bursts, dashboard aggregation, bulk case intake, multipart uploads and report generation at agreed volumes.
- Complete keyboard, screen-reader, zoom/contrast and real-device field checks.
- Perform threat modelling, dependency/container scan and independent penetration testing before live customer data.

## Scale decisions after usage data

- Add SQL full-text search only if execution plans show normal indexed search is insufficient.
- Move dashboard aggregation or report jobs to dedicated workers only when measured queue latency requires it.
- Add distributed rate limiting only when multiple API replicas make the current in-process limiter insufficient.
- Consider controlled native field software or device attestation only when the evidence standard requires stronger GPS anti-spoofing than browser geolocation can provide.
