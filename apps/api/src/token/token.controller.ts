import { Body, Controller, Post } from '@nestjs/common';
import { CreateTokenDto } from './dto/create-token.dto';
import { TokenService, TokenResult } from './token.service';

@Controller('token')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  // POST /token -> { token, livekitUrl }  (see docs/API_CONTRACT.md)
  @Post()
  async create(@Body() dto: CreateTokenDto): Promise<TokenResult> {
    return this.tokenService.createToken(dto.room, dto.identity, dto.name);
  }
}
