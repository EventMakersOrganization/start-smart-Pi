import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  Min,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
} from "class-validator";
import { Type } from "class-transformer";

export class SubmitQuizAnswerDto {
  @ApiProperty({ example: 0, description: "Index de la question" })
  @IsNumber()
  @Min(0)
  questionIndex: number;

  @ApiProperty({ example: 1, description: "Index de la réponse sélectionnée" })
  @IsNumber()
  @Min(0)
  selectedOptionIndex: number;

  @ApiPropertyOptional({
    example: 1,
    description: "Index de la bonne réponse",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  correctOptionIndex?: number;

  @ApiProperty({ example: true, description: "Si la réponse est correcte" })
  @IsBoolean()
  isCorrect: boolean;
}

export class SubmitQuizDto {
  @ApiProperty({ example: "quiz-123", description: "ID unique du quiz" })
  @IsNotEmpty()
  @IsString()
  quizId: string;

  @ApiProperty({
    example: "Quiz Spring Data JPA",
    description: "Titre du quiz",
  })
  @IsNotEmpty()
  @IsString()
  quizTitle: string;

  @ApiProperty({
    example: "Spring Data JPA - première Entité",
    description: "Titre de la matière",
  })
  @IsNotEmpty()
  @IsString()
  subjectTitle: string;

  @ApiProperty({ example: "Chapter 1", description: "Titre du chapitre" })
  @IsNotEmpty()
  @IsString()
  chapterTitle: string;

  @ApiProperty({
    example: "SubChapter 1.1",
    description: "Titre du sous-chapitre",
  })
  @IsNotEmpty()
  @IsString()
  subChapterTitle: string;

  @ApiProperty({ example: 2, description: "Nombre total de questions" })
  @IsNumber()
  @Min(1)
  totalQuestions: number;

  @ApiProperty({ example: 2, description: "Score obtenu" })
  @IsNumber()
  @Min(0)
  scoreObtained: number;

  @ApiPropertyOptional({ type: [SubmitQuizAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitQuizAnswerDto)
  answers: SubmitQuizAnswerDto[];
}
