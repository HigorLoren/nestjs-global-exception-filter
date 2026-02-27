import { HttpException } from '@nestjs/common';
import { ErrorResponse } from './error-response.model';

const EXTRACTION_COMPLETION_MESSAGES = {
  'non-empty-string':
    "Handled as non-empty string exception. There isn't much we can extract from them except for the message itself.",
  'string-response': 'Handled as string response.',
  'record-response': 'Handled as record response.',
  'http-exception-with-response-details':
    'Handled as HttpException instance with response details.',
  'simple-error-instance': 'Handled as a simple Error instance.',
  'unknown-exception':
    'Handled as unknown exception. The exception was added to the stack.'
} as const;

type ExtractionCompletionMessage =
  (typeof EXTRACTION_COMPLETION_MESSAGES)[keyof typeof EXTRACTION_COMPLETION_MESSAGES];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Extracts and parses exception information, populating the provided error response object.
 *
 * Handles multiple exception types in order of specificity:
 * 1. Non-empty strings - used directly as error message
 * 2. Error class instances - extracts message, name, and stack trace
 * 3. HttpException instances - extracts HTTP status code and parses response body
 * 4. Unknown exceptions - captures full content in stack trace
 *
 * @param exception - The exception to extract information from. Can be of any type.
 * @param errorResponse - The error response object to populate with extracted exception information.
 * @returns An extraction completion message indicating which extraction strategy was applied and the outcome.
 *
 * @remarks
 * - If the exception is both an Error and HttpException, more specific HttpException information takes precedence.
 * - HttpException responses can be strings or records; record responses may contain 'message' and 'error' fields.
 * - Unknown exception types have their full content serialized into the error response's stack trace.
 */
export const extractExceptionInfo = (
  exception: unknown,
  errorResponse: ErrorResponse
): ExtractionCompletionMessage => {
  const exceptionIsNonEmptyString =
    typeof exception === 'string' && exception.trim() !== '';

  if (exceptionIsNonEmptyString) {
    errorResponse.message = exception.trim();
    return EXTRACTION_COMPLETION_MESSAGES['non-empty-string'];
  }

  // Exception is unknown if not instance of Error or String, so we capture its full content in the
  // stack for later analysis and return early since we won't be able to extract any more structured information from it
  if (!(exception instanceof Error)) {
    errorResponse.fillStack(exception);
    return EXTRACTION_COMPLETION_MESSAGES['unknown-exception'];
  }

  // Handle *different types* of Error to extract basic information
  if (exception instanceof Error) {
    errorResponse.fillMessageAndDetails(exception.message);
    errorResponse.fillStack(exception.stack);
    errorResponse.error = exception.name;

    // We don't return early here, because if it's an instance of HttpException, we will try to
    // extract more specific information from it later
  }

  // Handle HttpExceptions separately to extract more detailed information
  if (exception instanceof HttpException) {
    errorResponse.statusCode = exception.getStatus();

    const response = exception.getResponse();

    // Many libraries throw HttpExceptions with a simple message string as the response body
    if (typeof response === 'string') {
      errorResponse.fillMessageAndDetails(response);
      return EXTRACTION_COMPLETION_MESSAGES['string-response'];
    }

    // If the response is a Record, try to extract more specific error information
    if (isRecord(response)) {
      if (
        'message' in response &&
        (typeof response.message === 'string' ||
          Array.isArray(response.message))
      ) {
        errorResponse.fillMessageAndDetails(response.message);
      }

      if (
        'error' in response &&
        typeof response.error === 'string' &&
        response.error.trim() !== ''
      ) {
        errorResponse.error = response.error;
      }

      return EXTRACTION_COMPLETION_MESSAGES['record-response'];
    }

    return EXTRACTION_COMPLETION_MESSAGES[
      'http-exception-with-response-details'
    ];
  }

  return EXTRACTION_COMPLETION_MESSAGES['simple-error-instance'];
};
