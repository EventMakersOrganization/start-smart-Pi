import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import * as express from "express";
import { existsSync, mkdirSync } from "fs";

jest.mock("@nestjs/core", () => ({
  NestFactory: { create: jest.fn() },
}));

jest.mock("helmet", () => {
  const helmetMock = jest.fn(() => "helmet-middleware");
  (helmetMock as any).contentSecurityPolicy = {
    getDefaultDirectives: jest.fn(() => ({ defaultSrc: ["'self'"] })),
  };
  return { __esModule: true, default: helmetMock };
});

jest.mock("express-rate-limit", () => ({
  __esModule: true,
  default: jest.fn(() => "rate-limit-middleware"),
}));

jest.mock("express", () => ({
  static: jest.fn(() => "static-middleware"),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

jest.mock("./app.module", () => ({
  AppModule: class MockAppModule {},
}));

const { bootstrap } = require("./main");

describe("main bootstrap", () => {
  const mockApp = {
    enableCors: jest.fn(),
    use: jest.fn(),
    useGlobalPipes: jest.fn(),
    setGlobalPrefix: jest.fn(),
    listen: jest.fn().mockResolvedValue(undefined),
    getUrl: jest.fn().mockResolvedValue("http://0.0.0.0:3000"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (NestFactory.create as jest.Mock).mockResolvedValue(mockApp);
    process.env.PORT = "3000";
    process.env.NODE_ENV = "production";
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  });

  it("configures app and starts in production", async () => {
    await bootstrap();

    expect(NestFactory.create).toHaveBeenCalled();
    expect(mockApp.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({ origin: true, credentials: true }),
    );
    expect(helmet).toHaveBeenCalled();
    expect(express.static).toHaveBeenCalled();
    expect(rateLimit).toHaveBeenCalledTimes(2);
    expect(mockApp.setGlobalPrefix).toHaveBeenCalledWith("api", {
      exclude: [{ path: "/metrics", method: RequestMethod.GET }],
    });
    expect(mockApp.listen).toHaveBeenCalledWith(3000, "0.0.0.0");
  });

  it("creates uploads subdirectories when missing", async () => {
    (existsSync as jest.Mock).mockReturnValue(false);

    await bootstrap();

    expect(mkdirSync).toHaveBeenCalledTimes(3);
  });

  it("sets insecure tls override in non-production", async () => {
    process.env.NODE_ENV = "development";

    await bootstrap();

    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe("0");
    expect(rateLimit).toHaveBeenCalledTimes(1);
  });

  it("logs helpful message on EADDRINUSE and rethrows", async () => {
    const err = Object.assign(new Error("address in use"), { code: "EADDRINUSE" });
    mockApp.listen.mockRejectedValueOnce(err);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(bootstrap()).rejects.toBe(err);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Port 3000 is already in use"));

    errorSpy.mockRestore();
  });

  it("applies global validation pipe", async () => {
    await bootstrap();

    const callArg = mockApp.useGlobalPipes.mock.calls[0]?.[0];
    expect(callArg).toBeInstanceOf(ValidationPipe);
  });
});
