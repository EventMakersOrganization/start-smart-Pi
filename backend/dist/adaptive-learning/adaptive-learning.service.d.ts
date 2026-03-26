import { Model } from "mongoose";
import { StudentProfile, StudentProfileDocument } from "../users/schemas/student-profile.schema";
import { StudentPerformance, StudentPerformanceDocument } from "./schemas/student-performance.schema";
import { Recommendation, RecommendationDocument } from "./schemas/recommendation.schema";
import { LevelTest, LevelTestDocument } from "./schemas/level-test.schema";
import { Question, QuestionDocument } from "./schemas/question.schema";
import { CreateStudentProfileDto } from "./dto/create-student-profile.dto";
import { CreateStudentPerformanceDto } from "./dto/create-student-performance.dto";
import { CreateRecommendationDto } from "./dto/create-recommendation.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
export declare class AdaptiveLearningService {
    private profileModel;
    private performanceModel;
    private recommendationModel;
    private levelTestModel;
    private questionModel;
    constructor(profileModel: Model<StudentProfileDocument>, performanceModel: Model<StudentPerformanceDocument>, recommendationModel: Model<RecommendationDocument>, levelTestModel: Model<LevelTestDocument>, questionModel: Model<QuestionDocument>);
    createProfile(dto: CreateStudentProfileDto): Promise<StudentProfile>;
    findAllProfiles(): Promise<StudentProfile[]>;
    findProfileByUserId(userId: string): Promise<StudentProfile>;
    updateProfile(userId: string, updateData: Partial<StudentProfile>): Promise<StudentProfile>;
    deleteProfile(userId: string): Promise<void>;
    createPerformance(dto: CreateStudentPerformanceDto): Promise<StudentPerformance & {
        adaptation?: any;
    }>;
    findAllPerformances(): Promise<StudentPerformance[]>;
    findPerformanceByStudent(studentId: string): Promise<StudentPerformance[]>;
    deletePerformance(id: string): Promise<void>;
    getAverageScore(studentId: string): Promise<number>;
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
    getSpacedRepetitionSchedule(studentId: string): Promise<{
        schedule: Array<{
            topic: string;
            lastScore: number;
            lastAttemptDate: Date;
            nextReviewDate: Date;
            intervalDays: number;
            urgency: "overdue" | "due_today" | "upcoming" | "scheduled";
            daysUntilReview: number;
            recommendedDifficulty: string;
        }>;
        overdueCount: number;
        dueTodayCount: number;
        nextSession: {
            topic: string;
            urgency: string;
            date: Date;
        } | null;
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
    getCollaborativeRecommendations(studentId: string): Promise<{
        recommendations: Array<{
            topic: string;
            reason: string;
            similarStudentsCount: number;
            averageSuccessRate: number;
            suggestedDifficulty: string;
        }>;
        similarStudentsFound: number;
        basedOn: string;
    }>;
    getStudyGroupSuggestions(studentId: string): Promise<{
        suggestedGroups: Array<{
            groupName: string;
            groupType: "remediation" | "mixed" | "advanced";
            commonTopics: string[];
            suggestedActivities: string[];
            compatibilityScore: number;
            members: Array<{
                userId: string;
                level: string;
                commonWeaknesses: string[];
            }>;
        }>;
        totalStudentsAnalyzed: number;
        bestMatch: {
            userId: string;
            compatibilityScore: number;
        } | null;
    }>;
    detectLearningStyle(studentId: string): Promise<{
        primaryStyle: string;
        secondaryStyle: string | null;
        confidence: number;
        styleDescription: string;
        learningTips: string[];
        indicators: {
            averageTimePerExercise: number;
            scoreConsistency: number;
            preferredDifficulty: string;
            preferredTopics: string[];
            sessionsPerWeek: number;
        };
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
    private computeTrend;
    private computePriority;
    private buildReasonV2;
    private buildWeakReason;
    private calcConfidence;
    private getWeekStartKey;
    private calculateStandardDeviation;
    private buildVelocityRecommendation;
    private findEarnedAtByScoreThreshold;
    private findEarnedAtByUniqueTopics;
    private computeLongestStreak;
    private computeTopicStats;
    private computeWeaknessImprovement;
    private computeComeback;
    private collectLevelSignals;
    createRecommendation(dto: CreateRecommendationDto): Promise<Recommendation>;
    findRecommendationsByStudent(studentId: string): Promise<Recommendation[]>;
    markRecommendationViewed(id: string): Promise<Recommendation>;
    deleteRecommendation(id: string): Promise<void>;
    createQuestion(dto: CreateQuestionDto): Promise<Question>;
    findAllQuestions(): Promise<Question[]>;
    createLevelTest(studentId: string): Promise<any>;
    submitLevelTest(id: string, answers: any[]): Promise<LevelTest>;
    findLevelTestByStudent(studentId: string): Promise<any>;
    generateInitialRecommendationsFromLevelTest(studentId: string): Promise<{
        recommendations: any[];
        source: string;
        levelTestScore: number;
        resultLevel: string;
        weaknessesAddressed: string[];
        strengthsChallenged: string[];
        totalGenerated: number;
    }>;
}
