import { GameMode } from '../schemas/game-session.schema';
export declare class CreateRoomDto {
    mode: GameMode;
    topic: string;
    difficulty: string;
}
