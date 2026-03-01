import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateStudentProfileDto {

  @IsString()
  userId: string;

  @IsOptional()
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  level?: string;

  @IsOptional()
  learningPreferences?: {
    preferredStyle?: string;
    preferredDifficulty?: string;
    studyHoursPerDay?: number;
  };
}