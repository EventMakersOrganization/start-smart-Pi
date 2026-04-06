import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { QuizQuestionDto } from "./add-subchapter-content.dto";

export class UpdateSubChapterContentDto {
  @ApiPropertyOptional({
    enum: ["cours", "exercices", "videos", "ressources"],
  })
  @IsString()
  @IsIn(["cours", "exercices", "videos", "ressources"])
  @IsOptional()
  folder?: "cours" | "exercices" | "videos" | "ressources";

  @ApiPropertyOptional({
    enum: ["file", "quiz", "video", "link", "prosit", "code"],
  })
  @IsString()
  @IsIn(["file", "quiz", "video", "link", "prosit", "code"])
  @IsOptional()
  type?: "file" | "quiz" | "video" | "link" | "prosit" | "code";

  @ApiPropertyOptional({ example: "Updated resource title" })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: "https://example.com/video" })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({ example: "Optional quiz instructions" })
  @IsString()
  @IsOptional()
  quizText?: string;

  @ApiPropertyOptional({ type: [QuizQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  @IsOptional()
  quizQuestions?: QuizQuestionDto[];

  @ApiPropertyOptional({ example: "lesson-1.pdf" })
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
