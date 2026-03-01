import { AdaptiveLearningService } from './adaptive-learning.service';
import { CreateStudentProfileDto } from './dto/create-student-profile.dto';
import { CreateStudentPerformanceDto } from './dto/create-student-performance.dto';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
export declare class AdaptiveLearningController {
    private readonly adaptiveService;
    constructor(adaptiveService: AdaptiveLearningService);
    createProfile(dto: CreateStudentProfileDto): Promise<import("../users/schemas/student-profile.schema").StudentProfile>;
    findAllProfiles(): Promise<import("../users/schemas/student-profile.schema").StudentProfile[]>;
    findProfile(userId: string): Promise<import("../users/schemas/student-profile.schema").StudentProfile>;
    updateProfile(userId: string, updateData: any): Promise<import("../users/schemas/student-profile.schema").StudentProfile>;
    deleteProfile(userId: string): Promise<void>;
    createPerformance(dto: CreateStudentPerformanceDto): Promise<import("./schemas/student-performance.schema").StudentPerformance>;
    findAllPerformances(): Promise<import("./schemas/student-performance.schema").StudentPerformance[]>;
    findPerformanceByStudent(studentId: string): Promise<import("./schemas/student-performance.schema").StudentPerformance[]>;
    getAverageScore(studentId: string): Promise<number>;
    deletePerformance(id: string): Promise<void>;
    createRecommendation(dto: CreateRecommendationDto): Promise<import("./schemas/recommendation.schema").Recommendation>;
    findRecommendationsByStudent(studentId: string): Promise<import("./schemas/recommendation.schema").Recommendation[]>;
    markViewed(id: string): Promise<import("./schemas/recommendation.schema").Recommendation>;
    deleteRecommendation(id: string): Promise<void>;
    createQuestion(dto: CreateQuestionDto): Promise<import("./schemas/question.schema").Question>;
    findAllQuestions(): Promise<import("./schemas/question.schema").Question[]>;
    createLevelTest(studentId: string): Promise<any>;
    submitLevelTest(id: string, body: {
        answers: any[];
    }): Promise<import("./schemas/level-test.schema").LevelTest>;
    findLevelTest(studentId: string): Promise<any>;
}
