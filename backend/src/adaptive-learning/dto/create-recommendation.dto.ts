import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';

export class CreateRecommendationDto {

  @IsString()
  studentId: string;

  @IsOptional()
  @IsString()
  recommendedContent?: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsEnum(['course', 'exercise', 'topic'])
  contentType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  confidenceScore?: number;
}