import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { ClarificationsModule } from "./clarifications/clarifications.module";
import { ClientsModule } from "./clients/clients.module";
import { JwtAuthGuard } from "./common/auth/jwt-auth.guard";
import { PermissionsGuard } from "./common/auth/permissions.guard";
import { PasswordChangeGuard } from "./common/auth/password-change.guard";
import { JsonSafeInterceptor } from "./common/http/json-safe.interceptor";
import { IdempotencyInterceptor } from "./common/http/idempotency.interceptor";
import { validateEnvironment } from "./config/env";
import { ConsentsModule } from "./consents/consents.module";
import { DashboardsModule } from "./dashboards/dashboards.module";
import { PrismaModule } from "./database/prisma.module";
import { DocumentsModule } from "./documents/documents.module";
import { FieldVisitsModule } from "./field-visits/field-visits.module";
import { HealthModule } from "./health/health.module";
import { QaModule } from "./qa/qa.module";
import { ReportsModule } from "./reports/reports.module";
import { VerificationModule } from "./verification/verification.module";
import { CasesModule } from "./cases/cases.module";
import { UsersModule } from "./users/users.module";
import { CrmModule } from "./crm/crm.module";
import { FinanceModule } from "./finance/finance.module";
import { SettingsModule } from "./settings/settings.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { CandidatePortalModule } from "./candidate-portal/candidate-portal.module";
import { SecurityModule } from "./common/security/security.module";
import { OutboxModule } from "./outbox/outbox.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 120 }]),
    PrismaModule,
    SecurityModule,
    AuthModule,
    ClientsModule,
    CasesModule,
    ConsentsModule,
    DocumentsModule,
    VerificationModule,
    UsersModule,
    CrmModule,
    FinanceModule,
    SettingsModule,
    NotificationsModule,
    CandidatePortalModule,
    OutboxModule,
    ClarificationsModule,
    QaModule,
    ReportsModule,
    FieldVisitsModule,
    DashboardsModule,
    AuditModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: JsonSafeInterceptor },
  ],
})
export class AppModule {}
