import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Exercise, ExerciseDocument, Difficulty } from './schemas/exercise.schema';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

@Injectable()
export class ExercisesService {
    constructor(
        @InjectModel(Exercise.name) private exerciseModel: Model<ExerciseDocument>,
    ) { }

    async create(createExerciseDto: CreateExerciseDto): Promise<Exercise> {
        const exercise = new this.exerciseModel(createExerciseDto);
        return exercise.save();
    }

    async findAll(
        page = 1,
        limit = 10,
        courseId?: string,
        difficulty?: Difficulty,
    ): Promise<PaginatedResult<Exercise>> {
        const filter: FilterQuery<ExerciseDocument> = {};
        if (courseId) filter.courseId = courseId;
        if (difficulty) filter.difficulty = difficulty;

        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.exerciseModel
                .find(filter)
                .populate('courseId', 'title level')
                .skip(skip)
                .limit(limit)
                .exec(),
            this.exerciseModel.countDocuments(filter),
        ]);

        return { data, total, page, limit };
    }

    async findOne(id: string): Promise<Exercise> {
        const exercise = await this.exerciseModel
            .findById(id)
            .populate('courseId', 'title level')
            .exec();
        if (!exercise) {
            throw new NotFoundException(`Exercise with ID "${id}" not found`);
        }
        return exercise;
    }

    async update(id: string, updateExerciseDto: UpdateExerciseDto): Promise<Exercise> {
        const exercise = await this.exerciseModel
            .findByIdAndUpdate(id, updateExerciseDto, { new: true })
            .populate('courseId', 'title level')
            .exec();
        if (!exercise) {
            throw new NotFoundException(`Exercise with ID "${id}" not found`);
        }
        return exercise;
    }

    async remove(id: string): Promise<void> {
        const result = await this.exerciseModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new NotFoundException(`Exercise with ID "${id}" not found`);
        }
    }
}
