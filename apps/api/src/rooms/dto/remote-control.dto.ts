import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const REMOTE_CONTROL_PROTOCOL_VERSION = 2 as const;

export class RequestRemoteControlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  sharerIdentity!: string;

  @IsIn([REMOTE_CONTROL_PROTOCOL_VERSION])
  protocolVersion!: typeof REMOTE_CONTROL_PROTOCOL_VERSION;
}

export class RedeemControlAgentTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  bootstrapCode!: string;

  @IsIn([REMOTE_CONTROL_PROTOCOL_VERSION])
  protocolVersion!: typeof REMOTE_CONTROL_PROTOCOL_VERSION;
}

export class RemoteControlProtocolDto {
  @IsIn([REMOTE_CONTROL_PROTOCOL_VERSION])
  protocolVersion!: typeof REMOTE_CONTROL_PROTOCOL_VERSION;
}
