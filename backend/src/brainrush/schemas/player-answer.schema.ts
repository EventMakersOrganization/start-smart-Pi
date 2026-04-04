import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlayerAnswerDocument = PlayerAnswer & Document;

@Schema({ timestamps: true })
export class PlayerAnswer {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'GameSession', required: true })
    gameSessionId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'QuestionInstance', required: true })
    questionId: Types.ObjectId;

    @Prop({ required: true })
    answerGiven: string;

    @Prop({ required: true })
    isCorrect: boolean;

    @Prop({ required: true })
    responseTime: number;

    @Prop({ required: true })
    difficulty: string; // easy, medium, hard

    @Prop()
    topic: string;
}

export const PlayerAnswerSchema = SchemaFactory.createForClass(PlayerAnswer);
