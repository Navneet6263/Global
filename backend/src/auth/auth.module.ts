import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AccountPasswordService } from "./account-password.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthTokenService } from "./auth-token.service";
import { AuthenticationService } from "./authentication.service";
import { JwtStrategy } from "./jwt.strategy";
import { SessionManagementService } from "./session-management.service";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({ useFactory: () => ({}) }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthenticationService,
    AuthTokenService,
    SessionManagementService,
    AccountPasswordService,
    JwtStrategy,
    ConfigService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
