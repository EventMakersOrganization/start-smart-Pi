import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";

export class CreatePrositSubmissionDto {
  @IsString()
  @IsNotEmpty()
  prositTitle: string;

  @IsString()
  @IsNotEmpty()
  chapterTitle: string;

  @IsString()
  @IsNotEmpty()
  subChapterTitle: string;

  @IsOptional()
  @IsString()
  subjectTitle?: string;

  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  studentName: string;

  @IsString()
  @IsNotEmpty()
  studentEmail: string;

  @IsOptional()
  @IsString()
  reportText?: string;

  @IsOptional()
  @IsString()
  reportHtml?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  wordCount?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class PrositSubmissionResponseDto {
  _id: string;
  prositTitle: string;
  chapterTitle: string;
  subChapterTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  fileName?: string;
  fileUrl?: string;
  status: string;
  submittedAt: Date;
  grade?: number;
  feedback?: string;
}
