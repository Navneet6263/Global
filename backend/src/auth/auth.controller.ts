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
  CurrentActor,
  Public,
} from "../common/auth/auth.decorators";
import type { Actor } from "../common/auth/actor";
import { PageQueryDto } from "../common/dto/page-query.dto";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { RenameSessionDto } from "./dto/rename-session.dto";
import { ttlSeconds } from "../config/ttl";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  async login(
    @Body() input: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const result = await this.auth.login(input, this.meta(request));
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
    if (!token) throw new UnauthorizedException("Refresh cookie is missing");
    const tokens = await this.auth.refresh(token, this.meta(request));
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
    const secure = this.config.get<boolean>("COOKIE_SECURE", false);
    response.setCookie("sg_access", tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: ttlSeconds(this.config.get<string>("JWT_ACCESS_TTL", "15m")),
    });
    response.setCookie("sg_refresh", tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/api/v1/auth",
      expires: tokens.refreshExpiresAt,
    });
  }

  private meta(request: FastifyRequest) {
    return { ipAddress: request.ip, userAgent: request.headers["user-agent"] };
  }
}
