import { Body, Controller, Post } from '@nestjs/common';
import { ControlAgentService } from './control-agent.service';
import { RedeemAgentCodeDto } from './dto/rooms.dto';

// Public by design: the one-time code is the bearer (single-use, 60s TTL,
// minted only for a verified in-call participant). The desktop agent calls
// this with the code it received via the huddle:// deep link.
@Controller('control-agent')
export class ControlAgentController {
  constructor(private readonly controlAgent: ControlAgentService) {}

  @Post('redeem')
  redeem(@Body() dto: RedeemAgentCodeDto) {
    return this.controlAgent.redeem(dto.code);
  }
}
