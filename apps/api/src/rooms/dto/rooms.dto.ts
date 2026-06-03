import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  room!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;
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
