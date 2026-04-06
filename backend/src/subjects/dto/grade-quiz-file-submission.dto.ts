import {
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
}
