import { IsNotEmpty, IsString } from "class-validator";

export class SubmitQuizFileDto {
  @IsString()
  @IsNotEmpty()
  quizId: string;

  @IsString()
  @IsNotEmpty()
  quizTitle: string;

  @IsString()
  @IsNotEmpty()
  subjectTitle: string;

  @IsString()
  @IsNotEmpty()
  chapterTitle: string;

  @IsString()
  @IsNotEmpty()
  subChapterTitle: string;
}
