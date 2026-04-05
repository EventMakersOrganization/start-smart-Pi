import { IsString, IsArray, IsEnum, IsNotEmpty } from 'class-validator';

export class CreateQuestionDto {
    @IsString()
    @IsNotEmpty()
    questionText: string;

    @IsArray()
    @IsString({ each: true })
    options: string[];

    @IsString()
    @IsNotEmpty()
    correctAnswer: string;

    @IsString()
    @IsNotEmpty()
    topic: string;

    @IsEnum(['beginner', 'intermediate', 'advanced'])
    difficulty: string;
}
