import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  AllowPasswordChangePending,
  AllowViewOnlyAdmin,
  CurrentActor,
  Public,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { PageQueryDto } from "../common/dto/page-query.dto";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { RenameSessionDto } from "./dto/rename-session.dto";
import {
  SignupResendDto,
  SignupStartDto,
  SignupVerifyDto,
} from "./dto/signup.dto";
import { SignupService } from "./signup.service";
import {
  clearSessionHint,
  ensureDeviceKey,
  requestMeta,
  setSessionCookies,
} from "./session-cookies";

/** A view-only Platform Admin still manages its own sign-in, password and sessions. */
@Controller("auth")
@AllowViewOnlyAdmin()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly signup: SignupService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  async login(
    @Body() input: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const deviceKey = this.deviceKey(request, response);
    const result = await this.auth.login(input, this.meta(request, deviceKey));
    this.setCookies(response, result.tokens);
    return { authenticated: true, session: result.session };
  }

  /** Public company sign-up: settings for the sign-up page. */
  @Public()
  @Get("signup/settings")
  signupSettings() {
    return this.signup.settings();
  }

  /** Step 1: company + admin details; a 6-digit code is emailed. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("signup")
  startSignup(@Body() input: SignupStartDto, @Req() request: FastifyRequest) {
    return this.signup.start(input, this.meta(request));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("signup/resend")
  resendSignup(@Body() input: SignupResendDto) {
    return this.signup.resend(input.signupId);
  }

  /** Step 2: the code creates the company (Onboarding) and signs the admin in. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("signup/verify")
  async verifySignup(
    @Body() input: SignupVerifyDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const deviceKey = this.deviceKey(request, response);
    const result = await this.signup.verify(
      input.signupId,
      input.otp,
      this.meta(request, deviceKey),
    );
    this.setCookies(response, result.tokens);
    return { authenticated: true, session: result.session };
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post("refresh")
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const token = (request.cookies as Record<string, string> | undefined)
      ?.sg_refresh;
    if (!token) {
      this.clearSessionHint(response);
      throw new UnauthorizedException("Refresh cookie is missing");
    }
    const deviceKey = this.deviceKey(request, response);
    const tokens = await this.auth
      .refresh(token, this.meta(request, deviceKey))
      .catch((error: unknown) => {
        this.clearSessionHint(response);
        throw error;
      });
    this.setCookies(response, tokens);
    return { authenticated: true };
  }

  @Public()
  @Post("logout")
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const token = (request.cookies as Record<string, string> | undefined)
      ?.sg_refresh;
    await this.auth.revoke(token);
    response.clearCookie("sg_access", { path: "/" });
    response.clearCookie("sg_refresh", { path: "/api/v1/auth" });
    this.clearSessionHint(response);
    return { authenticated: false };
  }

  @Get("me")
  @AllowPasswordChangePending()
  me(@CurrentActor() actor: Actor) {
    return this.auth.profile(actor);
  }

  @Get("sessions")
  sessions(@CurrentActor() actor: Actor) {
    return this.auth.sessions(actor);
  }

  @Get("security-events")
  securityEvents(@CurrentActor() actor: Actor, @Query() query: PageQueryDto) {
    return this.auth.securityEvents(actor, query);
  }

  @Patch("sessions/:sessionId")
  renameSession(
    @CurrentActor() actor: Actor,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() input: RenameSessionDto,
  ) {
    return this.auth.renameSession(actor, sessionId, input.name);
  }

  @Delete("sessions/others")
  revokeOtherSessions(@CurrentActor() actor: Actor) {
    return this.auth.revokeOtherSessions(actor);
  }

  @Delete("sessions/:sessionId")
  async revokeSession(
    @CurrentActor() actor: Actor,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const result = await this.auth.revokeSession(actor, sessionId);
    if (result.current) {
      response.clearCookie("sg_access", { path: "/" });
      response.clearCookie("sg_refresh", { path: "/api/v1/auth" });
      this.clearSessionHint(response);
    }
    return result;
  }

  @Post("change-password")
  @AllowPasswordChangePending()
  changePassword(
    @CurrentActor() actor: Actor,
    @Body() input: ChangePasswordDto,
  ) {
    return this.auth.changePassword(actor, input);
  }

  private setCookies(
    response: FastifyReply,
    tokens: {
      accessToken: string;
      refreshToken: string;
      refreshExpiresAt: Date;
    },
  ): void {
    setSessionCookies(this.config, response, tokens);
  }

  private clearSessionHint(response: FastifyReply): void {
    clearSessionHint(response);
  }

  private meta(request: FastifyRequest, deviceKey?: string) {
    return requestMeta(request, deviceKey);
  }

  private deviceKey(request: FastifyRequest, response: FastifyReply): string {
    return ensureDeviceKey(this.config, request, response);
  }
}
