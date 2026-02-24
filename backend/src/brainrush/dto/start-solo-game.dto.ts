import { IsEnum } from 'class-validator';

export class StartSoloGameDto {
  @IsEnum(['easy', 'medium', 'hard'])
  initialDifficulty: 'easy' | 'medium' | 'hard';
}
