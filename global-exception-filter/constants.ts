import { HttpStatus } from '@nestjs/common';

export const DEFAULT_ERROR_MESSAGE = 'Unknown error occurred' as const;
export const DEFAULT_ERROR = 'InternalServerError' as const;
export const DEFAULT_STATUS_CODE = HttpStatus.INTERNAL_SERVER_ERROR as const;
