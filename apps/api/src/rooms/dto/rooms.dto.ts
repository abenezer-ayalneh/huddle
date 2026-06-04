import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoomDto {
  // Human-readable meeting title (also used to derive the room slug).
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  title!: string;

  // Optional explicit URL slug; otherwise derived from the title server-side.
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'slug may only contain letters, numbers and hyphens',
  })
  slug?: string;

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
