import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { GameMode } from '../schemas/game-session.schema';

export class CreateRoomDto {
  @IsEnum(GameMode)
  mode: GameMode;

  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsString()
  @IsNotEmpty()
  difficulty: string;
}
