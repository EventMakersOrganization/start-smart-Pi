import { ChatService } from "./chat.service";
import { AiService, ClassifyDifficultyPayload, ClassifyDifficultyBatchPayload, EvaluateAnswerPayload, EvaluateBatchPayload, LearningEventPayload, RecordFeedbackPayload, UserRatingPayload } from "./ai.service";
export declare class ChatController {
    private readonly chatService;
    private readonly aiService;
    constructor(chatService: ChatService, aiService: AiService);
    createAiSession(req: any, body: {
        title?: string;
    }): Promise<import("./schemas/chat-ai.schema").ChatAi & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    createInstructorSession(req: any, body: {
        instructorId: string;
    }): Promise<any>;
    createRoom(req: any, body: {
        name: string;
        participants: string[];
    }): Promise<import("./schemas/chat-room.schema").ChatRoom & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    getUserSessions(req: any): Promise<{
        ai: import("mongoose").LeanDocument<import("./schemas/chat-ai.schema").ChatAi & import("mongoose").Document<any, any, any> & {
            _id: import("mongoose").Types.ObjectId;
        }>[];
        instructor: any[];
        rooms: any[];
    }>;
    getChatHistory(req: any, sessionType: string, sessionId: string): Promise<import("mongoose").LeanDocument<import("./schemas/chat-message.schema").ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>[]>;
    sendMessage(req: any, body: {
        sessionType: string;
        sessionId: string;
        content: string;
    }): Promise<import("./schemas/chat-message.schema").ChatMessage & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    semanticSearch(query: string, nResults?: string): Promise<{
        results: import("./ai.service").SemanticSearchResult[];
    }>;
    aiHealth(): Promise<{
        status: string;
        model?: string;
    }>;
    aiLatencyStats(): Promise<{
        status: string;
        stats: Record<string, any>;
    }>;
    monitorStats(minutes?: string): Promise<any>;
    monitorHealth(): Promise<import("./ai.service").MonitorHealthResponse>;
    monitorErrors(lastN?: string): Promise<import("./ai.service").MonitorErrorsResponse>;
    monitorThroughput(minutes?: string): Promise<import("./ai.service").MonitorThroughputResponse>;
    levelTestStart(req: any, body: {
        subjects?: string[];
    }): Promise<any>;
    levelTestSubmitAnswer(body: {
        session_id: string;
        answer: string;
    }): Promise<any>;
    levelTestComplete(body: {
        session_id: string;
    }): Promise<any>;
    levelTestSession(sessionId: string): Promise<any>;
    personalizedRecommendations(body: {
        student_profile: Record<string, any>;
        n_results?: number;
    }): Promise<any>;
    recordAdaptiveLearningEvent(req: any, body: LearningEventPayload): Promise<any>;
    evaluateAnswer(body: EvaluateAnswerPayload): Promise<any>;
    evaluateBatch(body: EvaluateBatchPayload): Promise<any>;
    classifyDifficulty(body: ClassifyDifficultyPayload): Promise<any>;
    classifySuggestAdjustment(body: ClassifyDifficultyPayload): Promise<any>;
    classifyDifficultyBatch(body: ClassifyDifficultyBatchPayload): Promise<any>;
    recordFeedback(body: RecordFeedbackPayload): Promise<any>;
    recordUserRating(body: UserRatingPayload): Promise<any>;
    getFeedbackRecommendations(): Promise<any>;
    getFeedbackStats(signalType: string, lastN?: string): Promise<any>;
    getAdaptiveLearningState(req: any): Promise<any>;
    getLearningAnalytics(req: any, studentId: string, refresh?: string): Promise<any>;
    getPaceAnalytics(req: any, studentId: string, refresh?: string): Promise<any>;
    getConceptsAnalytics(req: any, studentId: string, refresh?: string): Promise<any>;
    getInterventionsEffectiveness(req: any, studentId: string): Promise<any>;
    getInterventionsEffectivenessGlobal(): Promise<any>;
    private isTruthy;
}
