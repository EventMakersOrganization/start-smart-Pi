import { Model } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { SubjectDocument } from './schemas/subject.schema';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
export declare class SubjectsService {
    private readonly subjectModel;
    private readonly userModel;
    constructor(subjectModel: Model<SubjectDocument>, userModel: Model<UserDocument>);
    create(dto: CreateSubjectDto): Promise<{
        id: any;
        name: string;
        description: string;
        instructors: any;
        createdAt: any;
        updatedAt: any;
    }>;
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
    private normalizeIds;
    private assertAllInstructorsExist;
    private toResponse;
}
