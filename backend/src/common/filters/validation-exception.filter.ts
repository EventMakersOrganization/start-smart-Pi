import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
} from "@nestjs/common";
import { Response } from "express";

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    const errorResponse = {
      statusCode: status,
      message: exceptionResponse.message || "Bad Request",
      details:
        typeof exceptionResponse === "object"
          ? exceptionResponse
          : { error: exceptionResponse },
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorResponse);
  }
}
