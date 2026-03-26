import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
export declare class CoursesController {
    private readonly coursesService;
    constructor(coursesService: CoursesService);
    create(createCourseDto: CreateCourseDto): Promise<import("./schemas/course.schema").Course>;
    findAll(page: number, limit: number, level?: string, instructorId?: string): Promise<import("./courses.service").PaginatedResult<import("./schemas/course.schema").Course>>;
    findOne(id: string): Promise<import("./schemas/course.schema").Course>;
    update(id: string, updateCourseDto: UpdateCourseDto): Promise<import("./schemas/course.schema").Course>;
    remove(id: string): Promise<void>;
}
