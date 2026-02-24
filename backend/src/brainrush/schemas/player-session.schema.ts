import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlayerSessionDocument = PlayerSession & Document;

@Schema()
export class PlayerSession {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  gameSessionId: string;

  @Prop({ default: 0 })
  score: number;

  @Prop({ default: 0 })
  totalTimeSpent: number;

  @Prop({ default: 0 })
  questionsAnswered: number;

  @Prop({ default: 0 })
  correctAnswers: number;

  @Prop({ type: Object, default: {} })
  weaknesses: Record<string, any>; // For AI adaptation

  @Prop({ default: Date.now })
  joinedAt: Date;
}

export const PlayerSessionSchema = SchemaFactory.createForClass(PlayerSession);
