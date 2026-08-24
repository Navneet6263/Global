import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import * as classTransformer from "class-transformer";
import * as classValidator from "class-validator";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import fastifyCompress from "@fastify/compress";
import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import fastifyMultipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { AppModule } from "./app.module";
import { ProblemDetailsFilter } from "./common/http/problem-details.filter";

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    logger:
      process.env.NODE_ENV === "production"
        ? {
            level: process.env.LOG_LEVEL ?? "info",
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "res.headers.set-cookie",
              ],
              censor: "[REDACTED]",
            },
          }
        : false,
    trustProxy: process.env.TRUST_PROXY === "true",
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { bufferLogs: true },
  );
  const config = app.get(ConfigService);

  app.useLogger(["log", "error", "warn"]);
  app.setGlobalPrefix("api/v1");
  await app.register(fastifyHelmet, {
    crossOriginResourcePolicy: { policy: "same-site" },
  });
  await app.register(fastifyCompress);
  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, {
    attachFieldsToBody: false,
    limits: {
      files: 1,
      fileSize: config.get<number>("UPLOAD_MAX_BYTES", 10_485_760),
      fields: 8,
      parts: 9,
    },
  });
  const webOrigin = new URL(config.getOrThrow<string>("WEB_ORIGIN")).origin;
  adapter.getInstance().addHook("onRequest", (request, reply, done) => {
    reply.header("x-request-id", request.id);
    const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    const origin = request.headers.origin;
    const fetchSite = request.headers["sec-fetch-site"];
    if (
      mutating &&
      ((origin && origin !== webOrigin) || fetchSite === "cross-site")
    ) {
      void reply.code(403).send({
        status: 403,
        title: "Forbidden",
        detail: "Cross-site state-changing requests are not allowed",
        requestId: request.id,
      });
      return;
    }
    done();
  });
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      validatorPackage: classValidator,
      transformerPackage: classTransformer,
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();

  if (config.get("NODE_ENV") !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Sapling Global Verification API")
      .setDescription("Secure multi-tenant verification workflow API")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      "api/docs",
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  const port = config.get<number>("PORT", 4000);
  await app.listen(port, "0.0.0.0");
  Logger.log(`Sapling Global API listening on ${port}`, "Bootstrap");
}

void bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.stack : String(error),
    "Bootstrap",
  );
  process.exitCode = 1;
});
