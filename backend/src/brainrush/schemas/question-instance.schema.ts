import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type QuestionInstanceDocument = QuestionInstance & Document;

@Schema()
export class QuestionInstance {
  @Prop({ required: true })
  gameSessionId: string;

  @Prop({ required: true })
  question: string;

  @Prop({ type: [String], required: true })
  options: string[];

  @Prop({ required: true })
  correctAnswer: string;

  @Prop({ required: true })
  difficulty: 'easy' | 'medium' | 'hard';

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ type: [String], default: [] })
  answeredBy: string[]; // User IDs who answered
}

export const QuestionInstanceSchema = SchemaFactory.createForClass(QuestionInstance);
