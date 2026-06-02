import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  // Liveness probe — see docs/API_CONTRACT.md (GET /health).
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
