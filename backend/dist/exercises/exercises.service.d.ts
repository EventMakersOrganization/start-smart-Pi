import { Model } from 'mongoose';
import { Exercise, ExerciseDocument, Difficulty } from './schemas/exercise.schema';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}
export declare class ExercisesService {
    private exerciseModel;
    constructor(exerciseModel: Model<ExerciseDocument>);
    create(createExerciseDto: CreateExerciseDto): Promise<Exercise>;
    findAll(page?: number, limit?: number, courseId?: string, difficulty?: Difficulty): Promise<PaginatedResult<Exercise>>;
    findOne(id: string): Promise<Exercise>;
    update(id: string, updateExerciseDto: UpdateExerciseDto): Promise<Exercise>;
    remove(id: string): Promise<void>;
}
