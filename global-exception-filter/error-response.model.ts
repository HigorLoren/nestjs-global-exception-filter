import { HttpStatus } from '@nestjs/common';
import {
  DEFAULT_ERROR,
  DEFAULT_ERROR_MESSAGE,
  DEFAULT_STATUS_CODE
} from './constants';
import { maskSensitiveData } from '../../../utils/mask-sensitive-data';

/**
 * Represents a standardized error response for API exceptions.
 *
 * This class encapsulates error information including status codes, messages,
 * stack traces, and additional details. It provides utilities for formatting
 * and masking sensitive data in error responses.
 *
 * @example
 * ```typescript
 * const errorResponse = new ErrorResponse({
 *   requestId: 'req-123',
 *   statusCode: HttpStatus.BAD_REQUEST,
 *   message: 'Invalid input',
 *   error: 'ValidationError'
 * });
 * ```
 */
export class ErrorResponse {
  /**
   * Unique identifier for the request that generated this error.
   * @readonly
   */
  readonly requestId: string;

  /**
   * HTTP status code associated with this error.
   */
  statusCode: HttpStatus;

  /**
   * Human-readable error message.
   */
  message: string;

  /**
   * Error type or error code.
   */
  error: string;

  /**
   * Stack trace of the error, with sensitive data automatically masked.
   *
   * Always sanitized through {@link maskSensitiveData} before storage.
   * Use {@link fillStack} to set the stack trace from arbitrary input,
   * or pass it via the constructor's `stack` option.
   *
   * @see {@link fillStack} — for setting the stack trace after construction
   * @see {@link withoutStack} — for creating a copy without the stack trace
   * @see {@link toLoggerFormat} — includes the stack trace in formatted log output
   */
  get stack(): string | undefined {
    return this._stack;
  }

  /** @internal Backing field for {@link stack}. Prefer using the getter or {@link fillStack}. */
  private _stack?: string;

  /**
   * Array of additional error details or validation messages.
   * @optional
   */
  details?: string[];

  /**
   * ISO 8601 formatted timestamp when the error occurred.
   * @readonly
   */
  readonly timestamp: string;

  /**
   * Creates an instance of ErrorResponse.
   *
   * @param errorBody - Object containing error details
   * @param errorBody.requestId - Request identifier (required)
   * @param errorBody.statusCode - HTTP status code (defaults to {@link DEFAULT_STATUS_CODE})
   * @param errorBody.message - Error message (defaults to {@link DEFAULT_ERROR_MESSAGE})
   * @param errorBody.error - Error type (defaults to {@link DEFAULT_ERROR})
   * @param errorBody.stack - Stack trace to be masked
   * @param errorBody.details - Additional error details
   * @param errorBody.timestamp - Error timestamp (defaults to current ISO time)
   */
  constructor(errorBody: {
    requestId: string;
    statusCode?: HttpStatus;
    message?: string;
    error?: string;
    stack?: string;
    details?: string[];
    timestamp?: string;
  }) {
    this.requestId = errorBody.requestId;
    this.statusCode = errorBody?.statusCode || DEFAULT_STATUS_CODE;
    this.message = errorBody?.message || DEFAULT_ERROR_MESSAGE;
    this.error = errorBody?.error || DEFAULT_ERROR;
    this._stack = errorBody.stack
      ? maskSensitiveData(errorBody.stack)
      : undefined;
    this.details = errorBody.details;
    this.timestamp = errorBody.timestamp || new Date().toISOString();
  }

  /**
   * Populates the message and details fields from a message parameter.
   *
   * If message is a string, it becomes the main message.
   * If message is an array, the first non-empty string becomes the message,
   * and all strings become the details array.
   *
   * @param message - A string, array of strings, or other value to process
   * @returns void
   */
  fillMessageAndDetails(message?: string | unknown[]): void {
    this.message = DEFAULT_ERROR_MESSAGE;
    this.details = undefined;

    if (!message) return;

    if (typeof message === 'string') {
      const trimmed = message.trim();
      if (trimmed !== '') {
        this.message = maskSensitiveData(trimmed);
      }
      return;
    }

    const details = message
      .filter((item) => typeof item === 'string')
      .map((item) => maskSensitiveData(item.trim()))
      .filter((item) => item.length > 0);

    if (details.length > 0) {
      this.message = details[0];
      this.details = details;
    }
  }

  /**
   * Sets the stack trace, converting it to a string if necessary.
   *
   * Automatically masks sensitive data in the stack trace.
   * Handles string, object, and unknown types appropriately.
   *
   * @param stack - The stack trace to set
   * @returns void
   */
  fillStack(stack: unknown): void {
    if (typeof stack === 'string') {
      this._stack = maskSensitiveData(stack);
      return;
    }

    let stackString: string;
    try {
      stackString = maskSensitiveData(JSON.stringify(stack));
    } catch {
      stackString = String(stack);
    }
    this._stack = stackString;
  }

  /**
   * Creates a copy of this ErrorResponse without the stack trace.
   *
   * @returns A new ErrorResponse object minus the stack property
   */
  withoutStack(): Omit<ErrorResponse, 'stack'> {
    return new ErrorResponse({
      requestId: this.requestId,
      statusCode: this.statusCode,
      message: this.message,
      error: this.error,
      details: this.details,
      timestamp: this.timestamp
    });
  }

  /**
   * Formats the error response for logging purposes.
   *
   * Returns a formatted JSON string with error details.
   * If a stack trace exists, it is appended after the JSON output.
   * The timestamp is omitted as it's already logged by NestJS logger.
   *
   * @returns Formatted string suitable for logging
   */
  toLoggerFormat(): string {
    const json: Record<string, unknown> = {
      statusCode: this.statusCode,
      message: this.message,
      details: this.details,
      error: this.error
    };

    const jsonString = JSON.stringify(json, null, 2);
    return this.stack ? `${jsonString}\n\n${this.stack}` : jsonString;
  }
}
