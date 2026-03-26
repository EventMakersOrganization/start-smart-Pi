import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Difficulty, ExerciseType } from '../schemas/exercise.schema';

export class CreateExerciseDto {
    @ApiProperty({ description: 'ID of the course this exercise belongs to' })
    @IsMongoId()
    @IsNotEmpty()
    courseId: string;

    @ApiProperty({
        enum: Difficulty,
        description: 'Exercise difficulty level',
        example: Difficulty.MEDIUM,
    })
    @IsEnum(Difficulty)
    @IsNotEmpty()
    difficulty: Difficulty;

    @ApiProperty({ description: 'The exercise question or problem statement' })
    @IsString()
    @IsNotEmpty()
    content: string;

    @ApiProperty({ description: 'The correct answer to the exercise' })
    @IsString()
    @IsNotEmpty()
    correctAnswer: string;

    @ApiProperty({
        enum: ExerciseType,
        description: 'Type of exercise',
        example: ExerciseType.MCQ,
    })
    @IsEnum(ExerciseType)
    @IsNotEmpty()
    type: ExerciseType;
}
