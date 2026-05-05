import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import * as express from "express";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";

async function bootstrap() {
  // Bypass self-signed certificate errors in development
  if (process.env.NODE_ENV !== "production") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  const app = await NestFactory.create(AppModule);

  // Enable CORS for Angular frontend with credentials (no wildcard allowed)
  app.enableCors({
    origin: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  // Allow cross-origin resource loading for uploaded documents (PDF/DOCX previews).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "frame-ancestors": ["'self'", "http://localhost:4200"],
        },
      },
    }),
  );

  const uploadsRoot = resolve(__dirname, "..", "uploads");
  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }

  const chatAvatarsRoot = resolve(uploadsRoot, "chat-avatars");
  if (!existsSync(chatAvatarsRoot)) {
    mkdirSync(chatAvatarsRoot, { recursive: true });
  }

  const chatAttachmentsRoot = resolve(uploadsRoot, "chat-attachments");
  if (!existsSync(chatAttachmentsRoot)) {
    mkdirSync(chatAttachmentsRoot, { recursive: true });
  }

  app.use("/uploads", express.static(uploadsRoot));

  // Rate limiting - disabled in development, permissive in production
  if (process.env.NODE_ENV === "production") {
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        skip: (req) =>
          req.path === "/api/auth/login" ||
          // Kubernetes HTTP probes hit /api; do not count them or readiness/liveness will get 429
          (typeof req.headers["user-agent"] === "string" &&
            req.headers["user-agent"].includes("kube-probe")),
      }),
    );
    // Auth-specific limiter (stricter for login)
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // Max 10 login attempts per 15 min
      message: "Too many login attempts, please try again later.",
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use("/api/auth/login", authLimiter);
  } else {
    // Development: very permissive limits
    app.use(
      rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 1000, // Allow up to 1000 requests per minute in development
      }),
    );
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix("api");

  const port = Number(process.env.PORT) || 3000;
  try {
    await app.listen(port, "0.0.0.0");
    console.log(`Application is running on: ${await app.getUrl()}`);
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as NodeJS.ErrnoException).code
        : undefined;
    if (code === "EADDRINUSE") {
      console.error(
        `[Nest] Port ${port} is already in use. Stop the other server on this port, or start with a different port, e.g. set PORT=3001 in the environment.`,
      );
    }
    throw err;
  }
}
bootstrap();
