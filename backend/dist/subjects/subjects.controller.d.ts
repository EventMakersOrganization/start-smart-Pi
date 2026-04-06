import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
export declare class SubjectsController {
    private readonly subjectsService;
    constructor(subjectsService: SubjectsService);
    findAll(): Promise<{
        id: any;
        name: string;
        description: string;
        instructors: any;
        createdAt: any;
        updatedAt: any;
    }[]>;
    findOne(id: string): Promise<{
        id: any;
        name: string;
        description: string;
        instructors: any;
        createdAt: any;
        updatedAt: any;
    }>;
    create(dto: CreateSubjectDto): Promise<{
        id: any;
        name: string;
        description: string;
        instructors: any;
        createdAt: any;
        updatedAt: any;
    }>;
    update(id: string, dto: UpdateSubjectDto): Promise<{
        id: any;
        name: string;
        description: string;
        instructors: any;
        createdAt: any;
        updatedAt: any;
    }>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
}
