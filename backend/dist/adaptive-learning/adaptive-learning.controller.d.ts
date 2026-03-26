import { AdaptiveLearningService } from "./adaptive-learning.service";
import { CreateStudentProfileDto } from "./dto/create-student-profile.dto";
import { CreateStudentPerformanceDto } from "./dto/create-student-performance.dto";
import { CreateRecommendationDto } from "./dto/create-recommendation.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
export declare class AdaptiveLearningController {
    private readonly adaptiveService;
    constructor(adaptiveService: AdaptiveLearningService);
    createProfile(dto: CreateStudentProfileDto): Promise<import("../users/schemas/student-profile.schema").StudentProfile>;
    findAllProfiles(): Promise<import("../users/schemas/student-profile.schema").StudentProfile[]>;
    findProfile(userId: string): Promise<import("../users/schemas/student-profile.schema").StudentProfile>;
    updateProfile(userId: string, updateData: any): Promise<import("../users/schemas/student-profile.schema").StudentProfile>;
    deleteProfile(userId: string): Promise<void>;
    createPerformance(dto: CreateStudentPerformanceDto): Promise<import("./schemas/student-performance.schema").StudentPerformance & {
        adaptation?: any;
    }>;
    findAllPerformances(): Promise<import("./schemas/student-performance.schema").StudentPerformance[]>;
    findPerformanceByStudent(studentId: string): Promise<import("./schemas/student-performance.schema").StudentPerformance[]>;
    getAverageScore(studentId: string): Promise<number>;
    deletePerformance(id: string): Promise<void>;
    adaptDifficulty(studentId: string): Promise<{
        previousLevel: string;
        newLevel: string;
        reason: string;
        averageScore: number;
        performancesAnalyzed: number;
        action: "UP" | "DOWN" | "KEEP";
    }>;
    adaptDifficultyByTopic(studentId: string, topic: string): Promise<{
        topic: string;
        currentLevel: string;
        suggestedDifficulty: string;
        averageScore: number;
        recommendation: string;
    }>;
    generateRecommendations(studentId: string): Promise<{
        recommendations: any[];
        profile: any;
        weakTopics: string[];
        strongTopics: string[];
        totalGenerated: number;
    }>;
    generateRecommendationsV2(studentId: string): Promise<{
        recommendations: any[];
        profile: any;
        insights: {
            topicsAnalyzed: number;
            levelTestTopicsDetailed: any[];
            topicDiagnostics: any[];
        };
        totalGenerated: number;
    }>;
    generateInitialRecommendationsFromLevelTest(studentId: string): Promise<{
        recommendations: any[];
        source: string;
        levelTestScore: number;
        resultLevel: string;
        weaknessesAddressed: string[];
        strengthsChallenged: string[];
        totalGenerated: number;
    }>;
    getWeakAreaRecommendations(studentId: string): Promise<{
        weakAreas: Array<{
            topic: string;
            currentScore: number;
            suggestedDifficulty: "easy" | "medium" | "hard";
            action: string;
            encouragement: string;
            source: "level-test" | "performance" | "profile";
        }>;
        totalWeakAreas: number;
        mostUrgent: string;
    }>;
    getExerciseCompletionTracking(studentId: string): Promise<{
        summary: {
            totalAttempts: number;
            totalCompleted: number;
            completionRate: number;
            totalTimeSpent: number;
            currentStreak: number;
            averageScore: number;
        };
        byTopic: Array<{
            topic: string;
            attempts: number;
            completed: number;
            completionRate: number;
            averageScore: number;
            totalTimeSpent: number;
            lastAttemptDate: Date;
        }>;
        byDifficulty: {
            beginner: {
                attempts: number;
                completed: number;
                completionRate: number;
                averageScore: number;
            };
            intermediate: {
                attempts: number;
                completed: number;
                completionRate: number;
                averageScore: number;
            };
            advanced: {
                attempts: number;
                completed: number;
                completionRate: number;
                averageScore: number;
            };
        };
        recentActivity: Array<{
            exerciseId: string;
            topic: string;
            score: number;
            difficulty: string;
            date: Date;
            status: "passed" | "failed";
        }>;
    }>;
    getLearningVelocity(studentId: string): Promise<{
        globalVelocity: number;
        learningPace: "fast" | "normal" | "slow" | "declining";
        consistencyScore: number;
        weeklyProgress: number;
        byTopic: Array<{
            topic: string;
            velocity: number;
            firstScore: number;
            lastScore: number;
            improvement: number;
            sessionsCount: number;
        }>;
        recommendation: string;
    }>;
    getAchievementBadges(studentId: string): Promise<{
        totalBadges: number;
        earnedBadges: number;
        completionRate: number;
        badges: Array<{
            id: string;
            name: string;
            description: string;
            icon: string;
            category: string;
            earned: boolean;
            earnedAt?: Date;
            progress?: number;
        }>;
    }>;
    getLearningPath(studentId: string): Promise<{
        currentLevel: string;
        targetLevel: string;
        estimatedWeeks: number;
        steps: Array<{
            order: number;
            topic: string;
            action: string;
            priority: "high" | "medium" | "low";
            status: "pending" | "in-progress" | "completed";
        }>;
    }>;
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
