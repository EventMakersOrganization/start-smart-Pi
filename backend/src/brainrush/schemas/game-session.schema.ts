import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GameSessionDocument = GameSession & Document;

export enum GameMode {
  SOLO = 'solo',
  MULTIPLAYER = 'multiplayer',
}

@Schema({ timestamps: true })
export class GameSession {
  @Prop({ required: true })
  roomCode: string;

  @Prop({ type: String, enum: Object.values(GameMode), required: true })
  mode: GameMode;

  @Prop()
  topic: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  players: Types.ObjectId[];

  @Prop({ default: 10 })
  totalQuestions: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const GameSessionSchema = SchemaFactory.createForClass(GameSession);
