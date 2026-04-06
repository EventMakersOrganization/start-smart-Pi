import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { QuizQuestionDto } from "./add-chapter-content.dto";

export class UpdateChapterContentDto {
  @ApiPropertyOptional({ enum: ["file", "quiz", "video", "link"] })
  @IsString()
  @IsIn(["file", "quiz", "video", "link"])
  @IsOptional()
  type?: "file" | "quiz" | "video" | "link";

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
}
