import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuestionInstanceDocument = QuestionInstance & Document;

@Schema({ timestamps: true })
export class QuestionInstance {
  @Prop({ type: Types.ObjectId, ref: 'GameSession', required: true })
  gameSessionId: Types.ObjectId;

  @Prop({ required: true })
  questionText: string;

  @Prop({ type: [String], required: true })
  options: string[];

  @Prop({ required: true })
  correctAnswer: string;

  @Prop({ required: true })
  difficulty: string;
}

export const QuestionInstanceSchema = SchemaFactory.createForClass(QuestionInstance);
