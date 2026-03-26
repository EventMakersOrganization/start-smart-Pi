import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Course, CourseDocument } from './schemas/course.schema';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

@Injectable()
export class CoursesService {
    constructor(
        @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    ) { }

    async create(createCourseDto: CreateCourseDto): Promise<Course> {
        const course = new this.courseModel(createCourseDto);
        return course.save();
    }

    async findAll(
        page = 1,
        limit = 10,
        level?: string,
        instructorId?: string,
    ): Promise<PaginatedResult<Course>> {
        const filter: FilterQuery<CourseDocument> = {};
        if (level) filter.level = level;
        if (instructorId) filter.instructorId = instructorId;

        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.courseModel
                .find(filter)
                .populate('instructorId', 'name email')
                .skip(skip)
                .limit(limit)
                .exec(),
            this.courseModel.countDocuments(filter),
        ]);

        return { data, total, page, limit };
    }

    async findOne(id: string): Promise<Course> {
        const course = await this.courseModel
            .findById(id)
            .populate('instructorId', 'name email')
            .exec();
        if (!course) {
            throw new NotFoundException(`Course with ID "${id}" not found`);
        }
        return course;
    }

    async update(id: string, updateCourseDto: UpdateCourseDto): Promise<Course> {
        const course = await this.courseModel
            .findByIdAndUpdate(id, updateCourseDto, { new: true })
            .populate('instructorId', 'name email')
            .exec();
        if (!course) {
            throw new NotFoundException(`Course with ID "${id}" not found`);
        }
        return course;
    }

    async remove(id: string): Promise<void> {
        const result = await this.courseModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new NotFoundException(`Course with ID "${id}" not found`);
        }
    }
}
