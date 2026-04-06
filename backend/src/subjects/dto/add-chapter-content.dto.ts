import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
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

export class AddChapterContentDto {
  @ApiProperty({
    example: "file",
    enum: ["file", "quiz", "video", "link"],
  })
  @IsString()
  @IsIn(["file", "quiz", "video", "link"])
  type: "file" | "quiz" | "video" | "link";

  @ApiProperty({ example: "Chapter resource" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: "https://example.com/video" })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({ example: "Quiz instructions or questions" })
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
