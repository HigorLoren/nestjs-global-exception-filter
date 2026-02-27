import { HttpStatus } from '@nestjs/common';
import { ErrorResponse } from './error-response.model';

describe('ErrorResponse', () => {
  const baseBody = { requestId: 'req-1' };

  describe('constructor', () => {
    it('should apply defaults when optional fields are omitted', () => {
      const response = new ErrorResponse(baseBody);

      expect(response.requestId).toBe('req-1');
      expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).toBe('Unknown error occurred');
      expect(response.stack).toBeUndefined();
      expect(response.timestamp).toBeDefined();
    });

    it('should mask stack when provided', () => {
      const response = new ErrorResponse({
        ...baseBody,
        stack: 'Error at password=secret123'
      });

      expect(response.stack).not.toContain('secret123');
    });

    it('should preserve provided timestamp', () => {
      const ts = '2026-01-01T00:00:00.000Z';
      const response = new ErrorResponse({ ...baseBody, timestamp: ts });

      expect(response.timestamp).toBe(ts);
    });
  });

  describe('fillMessageAndDetails', () => {
    let response: ErrorResponse;

    beforeEach(() => {
      response = new ErrorResponse(baseBody);
    });

    it('should keep default message when called with undefined', () => {
      response.fillMessageAndDetails(undefined);

      expect(response.message).toBe('Unknown error occurred');
      expect(response.details).toBeUndefined();
    });

    it('should set message from non-empty string', () => {
      response.fillMessageAndDetails('Something went wrong');

      expect(response.message).toBe('Something went wrong');
    });

    it('should ignore empty or whitespace-only strings', () => {
      response.fillMessageAndDetails('   ');

      expect(response.message).toBe('Unknown error occurred');
    });

    it('should set message and details from string array', () => {
      response.fillMessageAndDetails(['Field is required', 'Invalid email']);

      expect(response.message).toBe('Field is required');
      expect(response.details).toEqual(['Field is required', 'Invalid email']);
    });

    it('should filter out non-string and empty items from array', () => {
      response.fillMessageAndDetails([
        42,
        '',
        'Valid message',
        null
      ] as unknown[]);

      expect(response.message).toBe('Valid message');
      expect(response.details).toEqual(['Valid message']);
    });

    it('should keep defaults when array has no valid items', () => {
      response.fillMessageAndDetails([42, null, ''] as unknown[]);

      expect(response.message).toBe('Unknown error occurred');
      expect(response.details).toBeUndefined();
    });
  });

  describe('fillStack', () => {
    let response: ErrorResponse;

    beforeEach(() => {
      response = new ErrorResponse(baseBody);
    });

    it('should set stack from string', () => {
      response.fillStack('Error\n    at main.ts:10');

      expect(response.stack).toContain('Error');
    });

    it('should stringify non-string values', () => {
      response.fillStack({ foo: 'bar' });

      expect(response.stack).toContain('foo');
    });
  });

  describe('withoutStack', () => {
    it('should return a copy without stack and preserve timestamp', () => {
      const original = new ErrorResponse({
        ...baseBody,
        stack: 'some stack',
        message: 'fail'
      });

      const sanitized = original.withoutStack();

      expect((sanitized as ErrorResponse).stack).toBeUndefined();
      expect(sanitized.message).toBe('fail');
      expect(sanitized.timestamp).toBe(original.timestamp);
    });
  });

  describe('toLoggerFormat', () => {
    it('should include stack when present', () => {
      const response = new ErrorResponse({ ...baseBody, stack: 'trace' });

      expect(response.toLoggerFormat()).toContain('trace');
    });

    it('should not append anything when stack is undefined', () => {
      const response = new ErrorResponse(baseBody);
      const output = response.toLoggerFormat();

      expect(output).not.toContain('undefined');
      expect(output).toContain('statusCode');
    });
  });
});
