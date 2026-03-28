import { HttpService } from '@nestjs/axios';
export declare class AiService {
    private readonly httpService;
    private readonly logger;
    private readonly AI_SERVICE_URL;
    constructor(httpService: HttpService);
    generateQuestion(subject: string, difficulty: string): Promise<any>;
    generateFeedback(strengths: string[], weaknesses: string[]): Promise<string>;
    private getFallbackQuestion;
}
