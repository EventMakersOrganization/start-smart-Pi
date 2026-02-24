import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScoreDocument = Score & Document;

@Schema()
export class Score {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  gameSessionId: string;

  @Prop({ required: true })
  score: number;

  @Prop({ required: true })
  timeSpent: number;

  @Prop({ required: true })
  difficulty: 'easy' | 'medium' | 'hard';

  @Prop({ type: Object })
  aiFeedback?: Record<string, any>;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const ScoreSchema = SchemaFactory.createForClass(Score);
