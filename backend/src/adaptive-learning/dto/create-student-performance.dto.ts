import {
  IsString, IsNumber, IsOptional,
  IsEnum, Min, Max
} from 'class-validator';

export class CreateStudentPerformanceDto {

  @IsString()
  studentId: string;

  @IsString()
  exerciseId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @IsOptional()
  @IsNumber()
  timeSpent?: number;

  @IsOptional()
  @IsEnum(['quiz', 'exercise', 'brainrush', 'level-test'])
  source?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  difficulty?: string;
}