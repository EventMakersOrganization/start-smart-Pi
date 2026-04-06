import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { AddChapterDto } from "./dto/add-chapter.dto";
import { AddChapterContentDto } from "./dto/add-chapter-content.dto";
import { AddSubChapterDto } from "./dto/add-subchapter.dto";
import { AddSubChapterContentDto } from "./dto/add-subchapter-content.dto";
import { UpdateSubChapterContentDto } from "./dto/update-subchapter-content.dto";
import { UpdateChapterContentDto } from "./dto/update-chapter-content.dto";
import { SubmitQuizDto } from "./dto/submit-quiz.dto";
import { SubmitQuizFileDto } from "./dto/submit-quiz-file.dto";
import { GradeQuizFileSubmissionDto } from "./dto/grade-quiz-file-submission.dto";
export declare class SubjectsController {
    private readonly subjectsService;
    constructor(subjectsService: SubjectsService);
    uploadCourseFile(file: any, req: any): {
        status: string;
        fileName: any;
        mimeType: any;
        fileUrl: string;
        path: string;
    };
    create(createSubjectDto: CreateSubjectDto): Promise<{
        id: any;
        name: any;
        description: string;
        instructors: any;
        createdAt: any;
        updatedAt: any;
    }>;
    findAll(instructorId?: string): Promise<{
        id: any;
        name: any;
        description: string;
        instructors: any;
        createdAt: any;
        updatedAt: any;
    }[]>;
    findOne(id: string): Promise<{
        id: any;
        name: any;
        description: string;
        instructors: any;
        createdAt: any;
        updatedAt: any;
    }>;
    addChapter(id: string, addChapterDto: AddChapterDto): Promise<import("./schemas/subject.schema").Subject>;
    deleteChapter(id: string, chapterOrder: number): Promise<import("./schemas/subject.schema").Subject>;
    addChapterContent(id: string, chapterOrder: number, addChapterContentDto: AddChapterContentDto): Promise<import("./schemas/subject.schema").Subject>;
    updateChapterContent(id: string, chapterOrder: number, contentId: string, updateChapterContentDto: UpdateChapterContentDto): Promise<import("./schemas/subject.schema").Subject>;
    deleteChapterContent(id: string, chapterOrder: number, contentId: string): Promise<import("./schemas/subject.schema").Subject>;
    addSubChapter(id: string, chapterOrder: number, addSubChapterDto: AddSubChapterDto): Promise<import("./schemas/subject.schema").Subject>;
    addSubChapterContent(id: string, chapterOrder: number, subChapterOrder: number, addSubChapterContentDto: AddSubChapterContentDto): Promise<import("./schemas/subject.schema").Subject>;
    updateSubChapterContent(id: string, chapterOrder: number, subChapterOrder: number, contentId: string, updateSubChapterContentDto: UpdateSubChapterContentDto): Promise<import("./schemas/subject.schema").Subject>;
    deleteSubChapterContent(id: string, chapterOrder: number, subChapterOrder: number, contentId: string): Promise<import("./schemas/subject.schema").Subject>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
    submitQuiz(req: any, submitQuizDto: SubmitQuizDto): Promise<import("./schemas/quiz-submission.schema").QuizSubmission>;
    getStudentQuizSubmissions(req: any): Promise<import("./schemas/quiz-submission.schema").QuizSubmission[]>;
    getQuizSubmission(submissionId: string): Promise<import("./schemas/quiz-submission.schema").QuizSubmission>;
    getLatestQuizSubmission(req: any, quizId: string): Promise<import("./schemas/quiz-submission.schema").QuizSubmission>;
    submitQuizFile(req: any, submitQuizFileDto: SubmitQuizFileDto, file: any): Promise<import("./schemas/quiz-file-submission.schema").QuizFileSubmission>;
    getStudentQuizFileSubmissions(req: any): Promise<import("./schemas/quiz-file-submission.schema").QuizFileSubmission[]>;
    getInstructorQuizFileSubmissions(req: any): Promise<import("./schemas/quiz-file-submission.schema").QuizFileSubmission[]>;
    gradeQuizFileSubmission(req: any, submissionId: string, gradeDto: GradeQuizFileSubmissionDto): Promise<import("./schemas/quiz-file-submission.schema").QuizFileSubmission>;
    update(id: string, dto: UpdateSubjectDto): Promise<{
        id: any;
        name: any;
        description: string;
        instructors: any;
        createdAt: any;
        updatedAt: any;
    }>;
}
