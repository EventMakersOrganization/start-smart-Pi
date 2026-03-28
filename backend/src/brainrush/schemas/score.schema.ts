import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ScoreDocument = Score & Document;

@Schema({ timestamps: true })
export class Score {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'GameSession', required: true })
  gameSessionId: Types.ObjectId;

  @Prop({ required: true })
  score: number;

  @Prop()
  timeSpent: number;

  @Prop()
  difficultyAchieved: string;

  @Prop()
  aiFeedback: string;
}

export const ScoreSchema = SchemaFactory.createForClass(Score);
