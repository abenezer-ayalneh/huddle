import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestRemoteControlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  sharerIdentity!: string;
}

export class RedeemControlAgentTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  bootstrapCode!: string;
}
