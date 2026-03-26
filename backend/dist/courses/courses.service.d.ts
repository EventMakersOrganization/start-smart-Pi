import { Model } from 'mongoose';
import { Course, CourseDocument } from './schemas/course.schema';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}
export declare class CoursesService {
    private courseModel;
    constructor(courseModel: Model<CourseDocument>);
    create(createCourseDto: CreateCourseDto): Promise<Course>;
    findAll(page?: number, limit?: number, level?: string, instructorId?: string): Promise<PaginatedResult<Course>>;
    findOne(id: string): Promise<Course>;
    update(id: string, updateCourseDto: UpdateCourseDto): Promise<Course>;
    remove(id: string): Promise<void>;
}
