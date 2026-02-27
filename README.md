# NestJS Global Exception Filter

A comprehensive example of a **Global Exception Filter** for [NestJS](https://nestjs.com/) applications. It catches all unhandled exceptions and returns standardized, traceable error responses to the client.

## Features

- **Centralized error handling** — catches every unhandled exception across controllers, services, guards, pipes, and interceptors.
- **Request ID tracking** — reuses the `X-Request-ID` header from the incoming request or generates a UUID v4 automatically.
- **Standardized error responses** — every error response follows a consistent JSON format with status code, message, error type, details, stack trace, and timestamp.
- **Sensitive data masking** — automatically masks values for patterns like `password`, `token`, `secret`, `apiKey`, `authorization`, and others in stack traces and messages.
- **Production-safe** — stack traces are stripped from responses when `NODE_ENV=production`, while still being logged server-side.
- **Smart exception parsing** — handles plain strings, `Error` instances, NestJS `HttpException` (including validation arrays), and unknown exception types.

## Prerequisites

- [Node.js](https://nodejs.org/) (>= 18 recommended)
- [NestJS](https://nestjs.com/) application scaffolded with the Express adapter

## Dependencies

| Package                    | Purpose                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `@nestjs/common`           | Core NestJS decorators and classes (`ExceptionFilter`, `Catch`, `ArgumentsHost`, `Logger`, `HttpStatus`, `HttpException`) |
| `@nestjs/core`             | NestJS runtime                                                                                                            |
| `@nestjs/platform-express` | Express adapter for NestJS                                                                                                |
| `express`                  | HTTP server (`Request`, `Response` types)                                                                                 |

> Node.js built-in modules `crypto` (`randomUUID`) and `http` (`IncomingHttpHeaders`) are also used — no additional install needed.

### Dev / Test Dependencies

| Package          | Purpose                     |
| ---------------- | --------------------------- |
| `jest`           | Test runner                 |
| `ts-jest`        | TypeScript support for Jest |
| `@types/jest`    | Jest type definitions       |
| `@types/express` | Express type definitions    |
| `typescript`     | TypeScript compiler         |

## Usage

Register the filter globally in your `main.ts`:

```ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./global-exception-filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(3000);
}
bootstrap();
```

From that point on, any unhandled exception will be intercepted and returned in a standardized format.

## Error Response Format

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "statusCode": 400,
  "message": "Invalid email",
  "error": "BadRequestException",
  "details": ["Invalid email", "Name is required"],
  "stack": "Error: ...\n    at ...",
  "timestamp": "2026-02-27T12:00:00.000Z"
}
```

| Field        | Type       | Always present | Description                                                |
| ------------ | ---------- | -------------- | ---------------------------------------------------------- |
| `requestId`  | `string`   | Yes            | UUID for request tracking                                  |
| `statusCode` | `number`   | Yes            | HTTP error code (default: `500`)                           |
| `message`    | `string`   | Yes            | Main error message (default: `"Unknown error occurred"`)   |
| `error`      | `string`   | Yes            | Error type/name (default: `"InternalServerError"`)         |
| `details`    | `string[]` | No             | Additional details (e.g. validation errors)                |
| `stack`      | `string`   | No             | Stack trace (removed in production, sensitive data masked) |
| `timestamp`  | `string`   | Yes            | ISO 8601 timestamp of when the error occurred              |

## How It Works

1. **Extract or generate a Request ID** — if the `X-Request-ID` header is present in the request, its value is reused; otherwise a UUID v4 is generated.
2. **Analyze the exception** — the parser (`extractExceptionInfo`) identifies the exception type and extracts relevant information (message, status, stack, details).
3. **Build the error response** — a standardized `ErrorResponse` object is created.
4. **Log the error** — request metadata and the full error response are logged at `error` level.
5. **Send the response** — the response is returned to the client with the `X-Request-ID` header and the appropriate HTTP status code.

### Exception Parsing Strategy

The parser handles exceptions in order of specificity:

| Exception Type           | Handling                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Non-empty `string`       | Used directly as the error message                                                                      |
| `Error` instance         | Extracts `message`, `name`, and `stack`                                                                 |
| `HttpException` (NestJS) | Extracts HTTP status code and parses the response body (string or record with `message`/`error` fields) |
| Unknown type             | Serializes the full content into the `stack` field for analysis                                         |

## Project Structure

```text
global-exception-filter/
├── constants.ts                    # Default values (status code, error message, error name)
├── error-response.model.ts         # ErrorResponse class with masking, formatting, and copy utilities
├── error-response.model.spec.ts    # Unit tests for ErrorResponse
├── exception-information-parser.ts # Parses different exception types into ErrorResponse
├── global-exception.filter.ts      # Main filter — catches exceptions and orchestrates the flow
├── GLOBAL-EXCEPTION-FILTER.md      # Detailed documentation and business rules
└── index.ts                        # Barrel export
```
