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
import { randomUUID } from "node:crypto";

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
    const deviceKey = this.deviceKey(request, response);
    const result = await this.auth.login(input, this.meta(request, deviceKey));
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
    const deviceKey = this.deviceKey(request, response);
    const tokens = await this.auth.refresh(
      token,
      this.meta(request, deviceKey),
    );
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

  private meta(request: FastifyRequest, deviceKey?: string) {
    const header = (name: string) => {
      const value = request.headers[name];
      return Array.isArray(value) ? value[0] : value;
    };
    const city = header("cf-ipcity") ?? header("x-vercel-ip-city");
    const region = header("cf-region") ?? header("x-vercel-ip-country-region");
    const country = header("cf-ipcountry") ?? header("x-vercel-ip-country");
    return {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
      deviceKey,
      locationLabel:
        [city, region, country].filter(Boolean).join(", ") || undefined,
    };
  }

  private deviceKey(request: FastifyRequest, response: FastifyReply): string {
    const existing = (request.cookies as Record<string, string> | undefined)
      ?.sg_device;
    const deviceKey =
      existing && /^[0-9a-f-]{36}$/i.test(existing) ? existing : randomUUID();
    response.setCookie("sg_device", deviceKey, {
      httpOnly: true,
      secure: this.config.get<boolean>("COOKIE_SECURE", false),
      sameSite: "strict",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
    return deviceKey;
  }
}
