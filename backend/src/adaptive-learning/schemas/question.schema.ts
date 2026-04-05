import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type QuestionDocument = Question & Document;

@Schema({ timestamps: true })
export class Question {

    @Prop({ required: true })
    questionText: string;

    @Prop({ type: [String], required: true })
    options: string[];

    @Prop({ required: true })
    correctAnswer: string;

    @Prop({ required: true })
    topic: string;

    @Prop({
        required: true,
        enum: ['beginner', 'intermediate', 'advanced']
    })
    difficulty: string;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
