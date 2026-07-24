import { ConsoleLogger, LogLevel } from '@nestjs/common';

// Structured JSON logger for production (one JSON object per line, so a log
// shipper / `docker logs | jq` can parse it). Falls back to Nest's pretty
// ConsoleLogger in dev. Dependency-free on purpose — no pino/winston to wire.
//
// Enabled via LOG_FORMAT=json (set in the prod compose env). See
// docs/adr/0004-deploy-topology-single-vps.md (observability).
export class JsonLogger extends ConsoleLogger {
  protected printMessages(messages: unknown[], context = '', logLevel: LogLevel = 'log'): void {
    for (const message of messages) {
      const line = JSON.stringify({
        level: logLevel,
        time: new Date().toISOString(),
        context: context || undefined,
        message: typeof message === 'string' ? message : (message as object),
      });
      const stream = logLevel === 'error' || logLevel === 'fatal' ? 'stderr' : 'stdout';
      process[stream].write(line + '\n');
    }
  }
}

// Pick the logger based on env: JSON in prod, Nest's default pretty logger in dev.
// Reads process.env directly (not ConfigService) on purpose: the logger is passed
// into NestFactory.create(), so it must exist *before* the app — and thus the
// ConfigModule — is instantiated. This is the one place ConfigService isn't yet
// available.
export function makeLogger(): ConsoleLogger {
  return process.env.LOG_FORMAT === 'json' ? new JsonLogger() : new ConsoleLogger();
}
