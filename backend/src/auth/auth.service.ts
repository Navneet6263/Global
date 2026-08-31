import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { PageQueryDto } from "../common/dto/page-query.dto";
import { AccountPasswordService } from "./account-password.service";
import { AuthenticationService } from "./authentication.service";
import { AuthTokenService } from "./auth-token.service";
import type { RequestMeta, TokenPair } from "./auth.types";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { LoginDto } from "./dto/login.dto";
import { SessionManagementService } from "./session-management.service";

/** Stable controller-facing facade for the independently testable auth services. */
@Injectable()
export class AuthService {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly tokens: AuthTokenService,
    private readonly sessionManagement: SessionManagementService,
    private readonly passwords: AccountPasswordService,
  ) {}

  login(input: LoginDto, meta: RequestMeta) {
    return this.authentication.login(input, meta);
  }

  refresh(refreshToken: string, meta: RequestMeta): Promise<TokenPair> {
    return this.tokens.refresh(refreshToken, meta);
  }

  revoke(refreshToken?: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }

  profile(actor: Actor) {
    return this.authentication.profile(actor);
  }

  sessions(actor: Actor) {
    return this.sessionManagement.sessions(actor);
  }

  securityEvents(actor: Actor, query: PageQueryDto) {
    return this.sessionManagement.securityEvents(actor, query);
  }

  renameSession(actor: Actor, sessionPublicId: string, name: string) {
    return this.sessionManagement.rename(actor, sessionPublicId, name);
  }

  revokeOtherSessions(actor: Actor) {
    return this.sessionManagement.revokeOthers(actor);
  }

  revokeSession(actor: Actor, sessionPublicId: string) {
    return this.sessionManagement.revoke(actor, sessionPublicId);
  }

  changePassword(actor: Actor, input: ChangePasswordDto) {
    return this.passwords.change(actor, input);
  }
}
