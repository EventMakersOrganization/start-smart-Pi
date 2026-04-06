import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsInt,
} from "class-validator";

export class QuizQuestionDto {
  @ApiProperty({ example: "What is a low-impact decision called?" })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({
    example: ["No-stakes", "Low-stakes", "High-stakes"],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  options: string[];

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  correctOptionIndex: number;
}

export class AddSubChapterContentDto {
  @ApiProperty({
    example: "cours",
    enum: ["cours", "exercices", "videos", "ressources"],
  })
  @IsString()
  @IsIn(["cours", "exercices", "videos", "ressources"])
  folder: "cours" | "exercices" | "videos" | "ressources";

  @ApiProperty({
    example: "file",
    enum: ["file", "quiz", "video", "link", "prosit", "code"],
  })
  @IsString()
  @IsIn(["file", "quiz", "video", "link", "prosit", "code"])
  type: "file" | "quiz" | "video" | "link" | "prosit" | "code";

  @ApiProperty({ example: "Lesson material" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: "https://example.com/video" })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({ example: "Quiz instructions" })
  @IsString()
  @IsOptional()
  quizText?: string;

  @ApiPropertyOptional({ type: [QuizQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  @IsOptional()
  quizQuestions?: QuizQuestionDto[];

  @ApiPropertyOptional({ example: "lesson.pdf" })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiPropertyOptional({ example: "application/pdf" })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @ApiPropertyOptional({ example: "2026-06-30T23:59:00.000Z" })
  @IsString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ example: "Rendu attendu: etude de cas (PDF)" })
  @IsString()
  @IsOptional()
  submissionInstructions?: string;

  @ApiPropertyOptional({ example: "public class Demo { ... }" })
  @IsString()
  @IsOptional()
  codeSnippet?: string;
}
