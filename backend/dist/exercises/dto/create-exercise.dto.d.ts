import { Difficulty, ExerciseType } from '../schemas/exercise.schema';
export declare class CreateExerciseDto {
    courseId: string;
    difficulty: Difficulty;
    content: string;
    correctAnswer: string;
    type: ExerciseType;
}
