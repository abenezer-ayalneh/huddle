import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { FaultCode } from './faults';

// One envelope for every error response the API emits (docs/adr/0017,
// docs/API_CONTRACT.md → "Faults & the error envelope").
type Envelope = { code: string; message: string; statusCode: number };

// A normalized error: either reshaped into the standard envelope, or passed
// through verbatim for endpoints that document their own error body (/ready).
type Normalized = { status: number; passthrough: true; body: unknown } | { status: number; passthrough: false; envelope: Envelope };

@Catch()
export class FaultFilter implements ExceptionFilter {
  private readonly logger = new Logger('FaultFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const normalized = this.normalize(exception);

    if (normalized.status >= 500) {
      // 5xx Faults: log loudly with the original stack for diagnosis.
      const code = normalized.passthrough ? FaultCode.INTERNAL : normalized.envelope.code;
      this.logger.error(`${code} ${normalized.status}`, exception instanceof Error ? exception.stack : String(exception));
    } else {
      // 4xx Domain Outcomes / client faults are expected — keep the logs quiet.
      const code = normalized.passthrough ? 'PASSTHROUGH' : normalized.envelope.code;
      this.logger.debug(`${code} ${normalized.status}`);
    }

    res.status(normalized.status).json(normalized.passthrough ? normalized.body : normalized.envelope);
  }

  private normalize(exception: unknown): Normalized {
    if (!(exception instanceof HttpException)) {
      // Unknown/unexpected error → opaque 500 (never leak internals to the client).
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        passthrough: false,
        envelope: { code: FaultCode.INTERNAL, message: 'Internal server error', statusCode: HttpStatus.INTERNAL_SERVER_ERROR },
      };
    }

    const status = exception.getStatus();
    const resp = exception.getResponse();

    // String response (e.g. `new NotFoundException('msg')` without a code).
    if (typeof resp !== 'object' || resp === null) {
      return this.envelope(status, this.defaultCode(status), typeof resp === 'string' ? resp : exception.message);
    }

    const obj = resp as Record<string, unknown>;

    // Explicit code attached via faultBody() — the normal path for our throws.
    if (typeof obj.code === 'string') {
      return this.envelope(status, obj.code, typeof obj.message === 'string' ? obj.message : exception.message);
    }

    // ValidationPipe rejects 400 with { message: string[], error, statusCode }.
    if (status === 400 && Array.isArray(obj.message)) {
      return this.envelope(status, FaultCode.VALIDATION, String(obj.message[0] ?? 'Invalid request'));
    }

    // A custom payload that is NOT a standard Nest exception body (no `message`
    // / `statusCode`) documents its own shape — pass it through untouched. This
    // keeps GET /ready's { status, checks } body intact.
    if (!('message' in obj) && !('statusCode' in obj)) {
      return { status, passthrough: true, body: obj };
    }

    return this.envelope(status, this.defaultCode(status), typeof obj.message === 'string' ? obj.message : exception.message);
  }

  private envelope(status: number, code: string, message: string): Normalized {
    return { status, passthrough: false, envelope: { code, message, statusCode: status } };
  }

  private defaultCode(status: number): string {
    return status >= 500 ? FaultCode.INTERNAL : 'ERROR';
  }
}
