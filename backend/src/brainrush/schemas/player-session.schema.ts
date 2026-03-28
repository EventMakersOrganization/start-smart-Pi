import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlayerSessionDocument = PlayerSession & Document;

@Schema({ timestamps: true })
export class PlayerSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'GameSession', required: true })
  gameSessionId: Types.ObjectId;

  @Prop({ default: 0 })
  score: number;

  @Prop({ default: 'medium' }) // easy, medium, hard
  currentDifficulty: string;

  @Prop({ default: 0 })
  consecutiveCorrect: number;

  @Prop({ default: 0 })
  consecutiveWrong: number;
}

export const PlayerSessionSchema = SchemaFactory.createForClass(PlayerSession);
