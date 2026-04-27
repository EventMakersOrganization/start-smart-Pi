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

export interface CourseSubjectChapter {
    title: string;
    description?: string;
    order: number;
    subChapters: any[];
}

export interface CourseSubjectView {
    _id: string;
    id: string;
    code: string;
    title: string;
    description?: string;
    chapters: CourseSubjectChapter[];
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

    private toSubjectCode(title: string): string {
        return String(title || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .replace(/_+/g, '_') || 'SUBJECT';
    }

    private normalizeSubjectKey(title: string): string {
        return String(title || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    private groupCoursesAsSubjects(rows: Course[]): CourseSubjectView[] {
        const map = new Map<string, CourseSubjectView>();
        for (const row of rows || []) {
            const subjectTitle = String((row as any)?.subject || 'General').trim() || 'General';
            const subjectKey = this.normalizeSubjectKey(subjectTitle) || 'general';
            const chapterTitle = String((row as any)?.title || '').trim();
            const subjectId = `course-subject:${subjectTitle}`;
            if (!map.has(subjectKey)) {
                map.set(subjectKey, {
                    _id: subjectId,
                    id: subjectId,
                    code: this.toSubjectCode(subjectTitle),
                    title: subjectTitle,
                    description: '',
                    chapters: [],
                });
            }
            const agg = map.get(subjectKey)!;
            if (subjectTitle.length > String(agg.title || '').length) {
                // Keep the richer display title when multiple variants collapse to one key.
                agg.title = subjectTitle;
                agg._id = `course-subject:${subjectTitle}`;
                agg.id = agg._id;
            }
            agg.chapters.push({
                title: chapterTitle,
                description: String((row as any)?.description || '').trim() || undefined,
                order: Number((row as any)?.chapterOrder ?? agg.chapters.length),
                subChapters: Array.isArray((row as any)?.subChapters) ? (row as any).subChapters : [],
            });
        }
        for (const [, subject] of map) {
            subject.chapters.sort((a, b) => Number(a.order) - Number(b.order));
        }
        return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
    }

    async findAllSubjects(instructorId?: string): Promise<CourseSubjectView[]> {
        const filter: FilterQuery<CourseDocument> = {};
        if (instructorId) {
            filter.instructorId = instructorId;
        }
        const rows = await this.courseModel.find(filter).exec();
        return this.groupCoursesAsSubjects(rows as any);
    }

    async findSubjectByTitle(subjectTitle: string, instructorId?: string): Promise<CourseSubjectView> {
        const list = await this.findAllSubjects(instructorId);
        const wanted = this.normalizeSubjectKey(subjectTitle);
        const found = list.find((s) => this.normalizeSubjectKey(String(s.title || '')) === wanted);
        if (!found) {
            throw new NotFoundException(`Subject "${subjectTitle}" not found`);
        }
        return found;
    }
}
