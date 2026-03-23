import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
export declare class AIIntegrationService {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly aiServiceUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    private getErrorMessage;
    searchCourses(query: string, nResults?: number): Promise<any>;
    generateQuestion(subject: string, difficulty: string, topic: string): Promise<any>;
    generateLevelTest(subject: string, numQuestions: number, difficulty: string): Promise<any>;
    embedAllCourses(): Promise<any>;
}
