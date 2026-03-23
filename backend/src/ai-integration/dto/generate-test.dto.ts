import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GenerateTestDto {
  @ApiProperty({ description: 'Subject for the level test', example: 'Programming' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Number of questions to generate', minimum: 1, maximum: 50 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  numQuestions: number;

  @ApiPropertyOptional({ description: 'Overall difficulty', example: 'medium' })
  @IsString()
  @IsOptional()
  difficulty?: string = 'medium';
}
