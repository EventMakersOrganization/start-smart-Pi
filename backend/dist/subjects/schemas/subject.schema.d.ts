import { Document, Types } from "mongoose";
export type SubjectDocument = Subject & Document;
export declare class QuizQuestion {
    question: string;
    options: string[];
    correctOptionIndex: number;
}
export declare const QuizQuestionSchema: import("mongoose").Schema<QuizQuestion, import("mongoose").Model<QuizQuestion, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, QuizQuestion>;
export declare class SubChapterContent {
    contentId: string;
    folder: "cours" | "exercices" | "videos" | "ressources";
    type: "file" | "quiz" | "video" | "link" | "prosit" | "code";
    title: string;
    url?: string;
    quizText?: string;
    quizQuestions?: QuizQuestion[];
    fileName?: string;
    mimeType?: string;
    dueDate?: Date;
    submissionInstructions?: string;
    codeSnippet?: string;
    createdAt?: Date;
}
export declare const SubChapterContentSchema: import("mongoose").Schema<SubChapterContent, import("mongoose").Model<SubChapterContent, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, SubChapterContent>;
export declare class SubChapter {
    title: string;
    description?: string;
    order: number;
    contents: SubChapterContent[];
}
export declare const SubChapterSchema: import("mongoose").Schema<SubChapter, import("mongoose").Model<SubChapter, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, SubChapter>;
export declare class Chapter {
    title: string;
    description?: string;
    order: number;
    subChapters: SubChapter[];
}
export declare const ChapterSchema: import("mongoose").Schema<Chapter, import("mongoose").Model<Chapter, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Chapter>;
export declare class Subject {
    code: string;
    title: string;
    description?: string;
    instructors: Types.ObjectId[];
    chapters: Chapter[];
    createdAt?: Date;
    updatedAt?: Date;
}
export declare const SubjectSchema: import("mongoose").Schema<Subject, import("mongoose").Model<Subject, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Subject>;
