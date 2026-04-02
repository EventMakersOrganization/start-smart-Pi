import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security Middleware
  app.use(helmet());

  // Enable CORS
  app.enableCors();

  // Rate limiting - disabled in development, permissive in production
  if (process.env.NODE_ENV === "production") {
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        skip: (req) => req.path === "/api/auth/login", // Exempt login from global limiter
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

  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
