import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class GradeQuizFileSubmissionDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  grade: number;

  @IsOptional()
  @IsString()
  teacherFeedback?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  correctAnswersCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalQuestionsCount?: number;
}
