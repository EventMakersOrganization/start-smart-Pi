import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateQuestionDto {
  @ApiProperty({ description: 'Subject area', example: 'Mathematics' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Difficulty level', example: 'medium' })
  @IsString()
  difficulty: string;

  @ApiPropertyOptional({ description: 'Topic within the subject', example: 'linear equations' })
  @IsString()
  @IsOptional()
  topic?: string = 'general';
}
