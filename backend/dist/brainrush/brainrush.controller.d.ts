import { BrainrushService } from './brainrush.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { StartSoloGameDto } from './dto/start-solo-game.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
export declare class BrainrushController {
    private readonly brainrushService;
    constructor(brainrushService: BrainrushService);
    startSoloGame(dto: StartSoloGameDto, req: any): Promise<{
        gameSessionId: any;
        playerSessionId: any;
        firstQuestion: import("mongoose").Document<unknown, {}, import("./schemas/question-instance.schema").QuestionInstanceDocument> & import("./schemas/question-instance.schema").QuestionInstance & import("mongoose").Document<any, any, any> & {
            _id: import("mongoose").Types.ObjectId;
        };
    }>;
    createRoom(dto: CreateRoomDto, req: any): Promise<{
        gameSessionId: any;
        roomCode: string;
    }>;
    joinRoom(dto: JoinRoomDto, req: any): Promise<{
        gameSessionId: any;
    }>;
    submitAnswer(dto: SubmitAnswerDto, req: any): Promise<{
        score: number;
        newQuestion: import("mongoose").Document<unknown, {}, import("./schemas/question-instance.schema").QuestionInstanceDocument> & import("./schemas/question-instance.schema").QuestionInstance & import("mongoose").Document<any, any, any> & {
            _id: import("mongoose").Types.ObjectId;
        };
        difficulty: "easy" | "medium" | "hard";
    }>;
    getLeaderboard(): Promise<import("./schemas/score.schema").Score[]>;
}
