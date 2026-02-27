import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { Response, Request } from 'express';
import { IncomingHttpHeaders } from 'http';
import { ErrorResponse } from './error-response.model';
import { randomUUID } from 'crypto';
import { extractExceptionInfo } from './exception-information-parser';

/**
 * Global exception filter that catches all unhandled exceptions in the application.
 *
 * Provides centralized error handling with the following features:
 * - Extracts or generates request IDs for tracking
 * - Creates standardized error responses
 * - Logs request and error information
 * - Masks error stack traces in production environment
 * - Sets X-Request-ID header in responses
 *
 * @implements {ExceptionFilter}
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProduction = process.env.NODE_ENV === 'production';

    const requestId =
      this.getRequestIdInHeaders(request.headers) || randomUUID();

    const errorResponse = this.createErrorResponse(requestId, exception);

    this.logRequestAndErrorResponse(
      {
        id: requestId,
        method: request.method,
        originalUrl: request.originalUrl
      },
      errorResponse
    );

    const safeguardedErrorResponse = isProduction
      ? errorResponse.withoutStack()
      : errorResponse;

    response
      .set('X-Request-ID', requestId)
      .status(safeguardedErrorResponse.statusCode)
      .json(safeguardedErrorResponse);
  }

  private getRequestIdInHeaders(headers: IncomingHttpHeaders): string | null {
    const requestIdFromHeader = headers['x-request-id'];

    if (
      typeof requestIdFromHeader === 'string' &&
      requestIdFromHeader.trim() !== ''
    ) {
      return requestIdFromHeader.trim();
    }

    if (
      Array.isArray(requestIdFromHeader) &&
      typeof requestIdFromHeader[0] === 'string' &&
      requestIdFromHeader[0].trim() !== ''
    ) {
      return requestIdFromHeader[0].trim();
    }

    return null;
  }

  private createErrorResponse(
    requestId: string,
    exception: unknown
  ): ErrorResponse {
    const errorResponse = new ErrorResponse({
      requestId
    });

    const whyExtractFinished = extractExceptionInfo(exception, errorResponse);
    this.logger.debug(`Why error extraction finished: "${whyExtractFinished}"`);

    return errorResponse;
  }

  private logRequestAndErrorResponse(
    request: {
      id: string;
      method: string;
      originalUrl: string;
    },
    errorResponse: ErrorResponse
  ) {
    this.logger.error(
      `Req [id ${request.id}] ${request.method} ${request.originalUrl}

${errorResponse.toLoggerFormat()}`
    );
  }
}
