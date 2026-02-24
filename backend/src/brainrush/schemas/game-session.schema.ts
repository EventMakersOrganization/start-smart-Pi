import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameSessionDocument = GameSession & Document;

@Schema()
export class GameSession {
  @Prop()
  roomCode?: string; // For multiplayer, undefined for solo

  @Prop({ required: true })
  mode: 'solo' | 'multiplayer';

  @Prop({ required: true })
  difficulty: 'easy' | 'medium' | 'hard';

  @Prop({ type: [String], default: [] })
  players: string[]; // User IDs

  @Prop({ default: Date.now })
  startedAt: Date;

  @Prop()
  endedAt?: Date;

  @Prop({ default: true })
  active: boolean;
}

export const GameSessionSchema = SchemaFactory.createForClass(GameSession);
