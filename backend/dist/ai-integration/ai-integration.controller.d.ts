import { AIIntegrationService } from './ai-integration.service';
import { SearchCoursesDto } from './dto/search-courses.dto';
import { GenerateQuestionDto } from './dto/generate-question.dto';
import { GenerateTestDto } from './dto/generate-test.dto';
export declare class AIIntegrationController {
    private readonly aiIntegrationService;
    constructor(aiIntegrationService: AIIntegrationService);
    search(dto: SearchCoursesDto): Promise<any>;
    generateQuestion(dto: GenerateQuestionDto): Promise<any>;
    generateTest(dto: GenerateTestDto): Promise<any>;
    embedCourses(): Promise<any>;
}
