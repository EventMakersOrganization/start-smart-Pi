import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { Difficulty } from './schemas/exercise.schema';
export declare class ExercisesController {
    private readonly exercisesService;
    constructor(exercisesService: ExercisesService);
    create(createExerciseDto: CreateExerciseDto): Promise<import("./schemas/exercise.schema").Exercise>;
    findAll(page: number, limit: number, courseId?: string, difficulty?: Difficulty): Promise<import("./exercises.service").PaginatedResult<import("./schemas/exercise.schema").Exercise>>;
    findOne(id: string): Promise<import("./schemas/exercise.schema").Exercise>;
    update(id: string, updateExerciseDto: UpdateExerciseDto): Promise<import("./schemas/exercise.schema").Exercise>;
    remove(id: string): Promise<void>;
}
