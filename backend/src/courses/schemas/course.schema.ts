import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseDocument = Course & Document;

@Schema({ _id: false })
export class SubChapterContent {
    @Prop({ required: true })
    contentId: string;

    @Prop({ required: true })
    folder: string;

    @Prop({ required: true })
    type: string;

    @Prop({ required: true })
    title: string;

    @Prop()
    url?: string;

    @Prop()
    fileName?: string;

    @Prop()
    mimeType?: string;

    @Prop()
    quizText?: string;

    @Prop({ type: [Object], default: undefined })
    quizQuestions?: any[];

    @Prop()
    dueDate?: Date;

    @Prop()
    submissionInstructions?: string;

    @Prop()
    codeSnippet?: string;

    @Prop()
    createdAt?: Date;
}

export const SubChapterContentSchema = SchemaFactory.createForClass(SubChapterContent);

@Schema({ _id: false })
export class CourseSubChapter {
    @Prop({ required: true })
    title: string;

    @Prop()
    description?: string;

    @Prop({ default: 0 })
    order: number;

    @Prop({ type: [SubChapterContentSchema], default: [] })
    contents: SubChapterContent[];
}

export const CourseSubChapterSchema = SchemaFactory.createForClass(CourseSubChapter);

@Schema({ timestamps: true })
export class Course {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    description: string;

    @Prop({ required: true })
    level: string;

    /** Logical subject / programme (e.g. all chapters under "Programmation Procédurale 1"). Matches MongoDB `subject`. */
    @Prop({ required: false })
    subject?: string;

    /** Optional back-reference to canonical subject document. */
    @Prop({ required: false })
    subjectId?: string;

    /** Chapter order inside the subject curriculum. */
    @Prop({ default: 0 })
    chapterOrder?: number;

    /** Canonical chapter structure used by subject learning flows. */
    @Prop({ type: [CourseSubChapterSchema], default: [] })
    subChapters?: CourseSubChapter[];

    @Prop({ type: Types.ObjectId, ref: 'User' })
    instructorId: Types.ObjectId;

    createdAt?: Date;
    updatedAt?: Date;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
