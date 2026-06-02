import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Request body for POST /token (see docs/API_CONTRACT.md).
// The client decides room/identity/name; the server decides the grants.
export class CreateTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  room!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  identity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;
}
