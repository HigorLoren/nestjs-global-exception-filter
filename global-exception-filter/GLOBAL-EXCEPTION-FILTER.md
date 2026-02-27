# Global Exception Filter

## What is it?

The **Global Exception Filter** is the component responsible for catching **all** unhandled exceptions in the application. It works as a safety net: any error that hasn't been handled by a `try/catch` or a more specific filter will be intercepted here.

The main goal is to ensure that **no exception escapes without being handled**, and that every error response sent to the client follows a standardized and traceable format.

---

## How does it work?

The filter is registered globally in `main.ts`:

```ts
app.useGlobalFilters(new GlobalExceptionFilter());
```

From that point on, any exception thrown in controllers, services, guards, pipes, or interceptors will be caught by it.

### What happens when an exception is caught?

1. **Extracts or generates a Request ID** — If the `X-Request-ID` header exists in the request, its value is reused. Otherwise, a UUID is automatically generated.
2. **Analyzes the exception** — The parser (`extractExceptionInfo`) identifies the exception type and extracts the relevant information (message, status, stack trace, details).
3. **Builds the error response** — A standardized `ErrorResponse` object is created with all the extracted information.
4. **Logs the error** — The request and error response are logged for troubleshooting.
5. **Sends the response** — The response is sent to the client with the `X-Request-ID` header and the correct HTTP status code.

> **In production**, the `stack` field is automatically removed from the response to avoid exposing internal details to the client.

---

## Error response format

Every error response follows this format:

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

| Field        | Type       | Always present? | Description                                                      |
| ------------ | ---------- | --------------- | ---------------------------------------------------------------- |
| `requestId`  | `string`   | Yes             | UUID for request tracking                                        |
| `statusCode` | `number`   | Yes             | HTTP error code (default: `500`)                                 |
| `message`    | `string`   | Yes             | Main error message (default: `"Unknown error occurred"`)         |
| `error`      | `string`   | Yes             | Error type/name (default: `"InternalServerError"`)               |
| `details`    | `string[]` | No              | List of additional details (e.g., validation errors)             |
| `stack`      | `string`   | No              | Error stack trace (removed in production, sensitive data masked) |
| `timestamp`  | `string`   | Yes             | ISO 8601 formatted date/time of when the error occurred          |

---

## Business rules

### BR01 — Request ID tracking

- Every error response **must** contain a `requestId`.
- If the client sends the `X-Request-ID` header, that value is reused.
- If the header doesn't exist or is empty, a UUID v4 is automatically generated.
- The `X-Request-ID` header is always included in the HTTP response.

### BR02 — Default status code

- When the exception doesn't contain HTTP status information (e.g., `throw new Error("failed")`), the default status code is **500 Internal Server Error**.

### BR03 — Sensitive data masking

- All stack trace and error message information goes through a masking filter before being stored.
- Masked patterns include: `password`, `token`, `secret`, `apiKey`, `authorization`, `api_key`, `access_token`, `refresh_token`, and `Bearer` tokens.
- Sensitive values are replaced with `****`.

### BR04 — Stack trace protection in production

- When `NODE_ENV === 'production'`, the `stack` field is **removed** from the response sent to the client.
- The full stack trace is still recorded in the server logs.

### BR05 — Defaults for unknown exceptions

- Exceptions that are neither `Error` nor `HttpException` are fully serialized into the `stack` field for analysis.
- The default message is `"Unknown error occurred"` and the default type is `"InternalServerError"`.

### BR06 — HttpException extraction priority

- If the exception is a NestJS `HttpException`, the HTTP status and response body are extracted with higher priority than the generic `Error` data.
- The response body can be a `string` (used as the message) or a `Record` (where the `message` and `error` fields are extracted individually).

### BR07 — Validation details

- When the exception message is an array (common with `ValidationPipe`), the first item becomes the `message` and all valid items (non-empty strings) form the `details` array.
- Non-string or empty items are automatically filtered out.

### BR08 — Error logging

- Every caught exception is logged at `error` level, including: Request ID, HTTP method, URL, and the full error response content.

---

## Exception Parser Flowchart

The diagram below shows the logic of `extractExceptionInfo`, responsible for analyzing the exception and populating the `ErrorResponse`:

[![Flowchart](https://mermaid.ink/img/pako:eNqFVUtu2zAQvQrBbBLAUi3ZcSy1TVH_EOdnIGkXbVUgtETZQiTSIGk4juFlT9Bti96tJ-gROiItWmkKxAvBJOe9eTPzKG1wzBOKQ5zmfBXPiVDowyBiCH7vv0R4-BDThco4QzFZzuYqwl-R45yi3ibCY4moPSaIcebQYqHWSCqRsdm7CG8jZqh6AEKfqNTYPvAWVEoyo-gtgtiioMkOBPwG0Teh3iEE__7xbc_u2MCjJ-zXXCMGz4QxlDGpCIsp4ikaCsFFXdqgLm0I2e722mgZ7O7Wb6bi1anesSeMFGYb-ON7u61Xd7YU8xzqBKMX5J0ptbA9fyZzV-M1V3QASv_8-v4TfWRzwpIcOrgnVesFdbWwWyWWsVoKOE6IIjBFxrhCUwrRSpBY0cStZjqpco3qLTmDRKBPLWUfjFLWWKVxZ1Td6pPDo3-KPdPQsSl276EbKhecSYp6PFmDZepGKWFjW964Ku-KsDXKs6kgIgNFai746mmXJFplal6yZcUip6ganyFHpARRJKrUU0it1ZqUOlm93vMn7qxgtr5zE2R9abI4tThry3FtZBcvteKGxlwk9Ylf1FVd6ruoJ2YLhLEbw6FU8GLHgLK0rHcNY8qksrIvDYuVLXTwf2Vf1GRfVfFz6LhjJ--UHbdgJ6GKZLmsk4zqdrW90gNytGancn0dNTFe01fp_HZy7ZruZun60ObeW21iXGtrWrJ7xldsL7NOHedEygFNUczhdcMUSrM8Dw9Go1HQbzcgD7-nsOz1m_6gEfOci_Cg2WzuTpyESHg3CrIOj9FxI-VMOTJ7pKHnva7xm5tZpXh2MrYnuIFnIktwCNeTNsBvoiDlEm9KTIRhggV0JoS_jC5h7HmEI7YF2IKwz5wXFVJweCvjMCW5hNVyAZecDjIyE6Swu4KyhIo-XzKFQy8ImoGmweEGP-DQ99tuu91sd7227590mp1OA69x6LQC96TbCgK_CxGdtr9t4Eed2HOb_onX8o89z2t1Aw_iaZIpLq7Mh0R_T7Z_AfsODk8?type=png)](https://mermaid.live/edit#pako:eNqFVUtu2zAQvQrBbBLAUi3ZcSy1TVH_EOdnIGkXbVUgtETZQiTSIGk4juFlT9Bti96tJ-gROiItWmkKxAvBJOe9eTPzKG1wzBOKQ5zmfBXPiVDowyBiCH7vv0R4-BDThco4QzFZzuYqwl-R45yi3ibCY4moPSaIcebQYqHWSCqRsdm7CG8jZqh6AEKfqNTYPvAWVEoyo-gtgtiioMkOBPwG0Teh3iEE__7xbc_u2MCjJ-zXXCMGz4QxlDGpCIsp4ikaCsFFXdqgLm0I2e722mgZ7O7Wb6bi1anesSeMFGYb-ON7u61Xd7YU8xzqBKMX5J0ptbA9fyZzV-M1V3QASv_8-v4TfWRzwpIcOrgnVesFdbWwWyWWsVoKOE6IIjBFxrhCUwrRSpBY0cStZjqpco3qLTmDRKBPLWUfjFLWWKVxZ1Td6pPDo3-KPdPQsSl276EbKhecSYp6PFmDZepGKWFjW964Ku-KsDXKs6kgIgNFai746mmXJFplal6yZcUip6ganyFHpARRJKrUU0it1ZqUOlm93vMn7qxgtr5zE2R9abI4tThry3FtZBcvteKGxlwk9Ylf1FVd6ruoJ2YLhLEbw6FU8GLHgLK0rHcNY8qksrIvDYuVLXTwf2Vf1GRfVfFz6LhjJ--UHbdgJ6GKZLmsk4zqdrW90gNytGancn0dNTFe01fp_HZy7ZruZun60ObeW21iXGtrWrJ7xldsL7NOHedEygFNUczhdcMUSrM8Dw9Go1HQbzcgD7-nsOz1m_6gEfOci_Cg2WzuTpyESHg3CrIOj9FxI-VMOTJ7pKHnva7xm5tZpXh2MrYnuIFnIktwCNeTNsBvoiDlEm9KTIRhggV0JoS_jC5h7HmEI7YF2IKwz5wXFVJweCvjMCW5hNVyAZecDjIyE6Swu4KyhIo-XzKFQy8ImoGmweEGP-DQ99tuu91sd7227590mp1OA69x6LQC96TbCgK_CxGdtr9t4Eed2HOb_onX8o89z2t1Aw_iaZIpLq7Mh0R_T7Z_AfsODk8)

---

## Module files

| File                              | Responsibility                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `global-exception.filter.ts`      | Main filter — catches exceptions, orchestrates the flow, and sends the response      |
| `exception-information-parser.ts` | Parser that analyzes the exception type and extracts information for `ErrorResponse` |
| `error-response.model.ts`         | Error response model with utilities (masking, formatting, stack-free copy)           |
| `constants.ts`                    | Default values (`DEFAULT_ERROR_MESSAGE`, `DEFAULT_ERROR`, `DEFAULT_STATUS_CODE`)     |
| `error-response.model.spec.ts`    | Unit tests for the `ErrorResponse` model                                             |
| `index.ts`                        | Barrel export of the filter                                                          |
