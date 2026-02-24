import { IsEnum, IsOptional } from 'class-validator';

export class CreateRoomDto {
  @IsEnum(['easy', 'medium', 'hard'])
  initialDifficulty: 'easy' | 'medium' | 'hard';

  @IsOptional()
  roomCode?: string; // Optional, generate if not provided
}
