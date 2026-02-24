import { IsString, IsNumber } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  gameSessionId: string;

  @IsString()
  questionId: string;

  @IsString()
  answer: string;

  @IsNumber()
  timeSpent: number; // in milliseconds
}
