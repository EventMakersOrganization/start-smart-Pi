import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExerciseDocument = Exercise & Document;

export enum Difficulty {
    EASY = 'easy',
    MEDIUM = 'medium',
    HARD = 'hard',
}

export enum ExerciseType {
    QUIZ = 'quiz',
    MCQ = 'MCQ',
    PROBLEM = 'problem',
}

@Schema({ timestamps: true })
export class Exercise {
    @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
    courseId: Types.ObjectId;

    @Prop({
        type: String,
        enum: Object.values(Difficulty),
        required: true,
    })
    difficulty: Difficulty;

    @Prop({ required: true })
    content: string;

    @Prop({ required: true })
    correctAnswer: string;

    @Prop({
        type: String,
        enum: Object.values(ExerciseType),
        required: true,
    })
    type: ExerciseType;

    createdAt?: Date;
    updatedAt?: Date;
}

export const ExerciseSchema = SchemaFactory.createForClass(Exercise);
