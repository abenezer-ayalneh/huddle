import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoomDto {
  // A room has no title and no client-chosen identifier: the server always
  // generates a unique Room Code. The only input is an optional scheduled time.
  // Optional ISO-8601 scheduled start time; omit for "start now".
  @IsOptional()
  @IsISO8601()
  scheduledStart?: string;
}

export class KnockDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;
}

export class MuteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  identity!: string;

  @IsBoolean()
  muted!: boolean;
}

export class MuteOnEntryDto {
  @IsBoolean()
  muted!: boolean;
}
