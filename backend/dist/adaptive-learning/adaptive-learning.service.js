"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveLearningService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const student_profile_schema_1 = require("../users/schemas/student-profile.schema");
const student_performance_schema_1 = require("./schemas/student-performance.schema");
const recommendation_schema_1 = require("./schemas/recommendation.schema");
const level_test_schema_1 = require("./schemas/level-test.schema");
const question_schema_1 = require("./schemas/question.schema");
let AdaptiveLearningService = class AdaptiveLearningService {
    constructor(profileModel, performanceModel, recommendationModel, levelTestModel, questionModel) {
        this.profileModel = profileModel;
        this.performanceModel = performanceModel;
        this.recommendationModel = recommendationModel;
        this.levelTestModel = levelTestModel;
        this.questionModel = questionModel;
    }
    async createProfile(dto) {
        const profile = await this.profileModel
            .findOneAndUpdate({ userId: dto.userId }, {
            $setOnInsert: dto,
        }, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
        })
            .exec();
        return profile;
    }
    async findAllProfiles() {
        return this.profileModel.find().exec();
    }
    async findProfileByUserId(userId) {
        const profile = await this.profileModel.findOne({ userId }).exec();
        if (!profile)
            throw new common_1.NotFoundException(`Profile not found for user ${userId}`);
        return profile;
    }
    async updateProfile(userId, updateData) {
        const updated = await this.profileModel
            .findOneAndUpdate({ userId }, updateData, { new: true })
            .exec();
        if (!updated)
            throw new common_1.NotFoundException(`Profile not found for user ${userId}`);
        return updated;
    }
    async deleteProfile(userId) {
        await this.profileModel.findOneAndDelete({ userId }).exec();
    }
    async createPerformance(dto) {
        const performance = new this.performanceModel(dto);
        await performance.save();
        try {
            const adaptation = await this.adaptDifficulty(dto.studentId);
            const result = performance.toObject();
            result.adaptation = adaptation;
            return result;
        }
        catch {
            return performance.toObject();
        }
    }
    async findAllPerformances() {
        return this.performanceModel.find().exec();
    }
    async findPerformanceByStudent(studentId) {
        return this.performanceModel
            .find({ studentId })
            .sort({ attemptDate: -1 })
            .exec();
    }
    async deletePerformance(id) {
        await this.performanceModel.findByIdAndDelete(id).exec();
    }
    async getAverageScore(studentId) {
        const result = await this.performanceModel.aggregate([
            { $match: { studentId } },
            { $group: { _id: null, avg: { $avg: "$score" } } },
        ]);
        return result[0]?.avg || 0;
    }
    async adaptDifficulty(studentId) {
        const profile = await this.profileModel
            .findOne({ userId: studentId })
            .exec();
        const currentLevel = profile?.level || "beginner";
        const recentPerformances = await this.performanceModel
            .find({ studentId })
            .sort({ attemptDate: -1 })
            .limit(5)
            .exec();
        if (recentPerformances.length < 3) {
            return {
                previousLevel: currentLevel,
                newLevel: currentLevel,
                reason: `Not enough data to adapt. Need at least 3 performances, have ${recentPerformances.length}.`,
                averageScore: 0,
                performancesAnalyzed: recentPerformances.length,
                action: "KEEP",
            };
        }
        const totalScore = recentPerformances.reduce((sum, p) => sum + p.score, 0);
        const averageScore = Math.round(totalScore / recentPerformances.length);
        let newLevel = currentLevel;
        let action = "KEEP";
        let reason = "";
        if (averageScore >= 80) {
            if (currentLevel === "beginner") {
                newLevel = "intermediate";
                action = "UP";
                reason = `Excellent performance! Average score ${averageScore}% >= 80%. Promoted from Beginner to Intermediate.`;
            }
            else if (currentLevel === "intermediate") {
                newLevel = "advanced";
                action = "UP";
                reason = `Outstanding performance! Average score ${averageScore}% >= 80%. Promoted from Intermediate to Advanced.`;
            }
            else {
                action = "KEEP";
                reason = `Already at maximum level (Advanced). Keep up the great work with ${averageScore}% average!`;
            }
        }
        else if (averageScore <= 40) {
            if (currentLevel === "advanced") {
                newLevel = "intermediate";
                action = "DOWN";
                reason = `Average score ${averageScore}% <= 40%. Level adjusted from Advanced to Intermediate to consolidate foundations.`;
            }
            else if (currentLevel === "intermediate") {
                newLevel = "beginner";
                action = "DOWN";
                reason = `Average score ${averageScore}% <= 40%. Level adjusted from Intermediate to Beginner to rebuild core concepts.`;
            }
            else {
                action = "KEEP";
                reason = `Already at minimum level (Beginner). Average score ${averageScore}%. Focus on improving fundamentals.`;
            }
        }
        else {
            action = "KEEP";
            reason = `Average score ${averageScore}% is between 40% and 80%. Current level (${currentLevel}) is appropriate. Keep practicing!`;
        }
        if (newLevel !== currentLevel) {
            const newRiskLevel = averageScore >= 70 ? "LOW" : averageScore >= 40 ? "MEDIUM" : "HIGH";
            await this.profileModel
                .findOneAndUpdate({ userId: studentId }, {
                level: newLevel,
                risk_level: newRiskLevel,
                progress: averageScore,
            }, { new: true })
                .exec();
        }
        return {
            previousLevel: currentLevel,
            newLevel,
            reason,
            averageScore,
            performancesAnalyzed: recentPerformances.length,
            action,
        };
    }
    async adaptDifficultyByTopic(studentId, topic) {
        const topicPerformances = await this.performanceModel
            .find({ studentId, topic })
            .sort({ attemptDate: -1 })
            .limit(5)
            .exec();
        const profile = await this.profileModel
            .findOne({ userId: studentId })
            .exec();
        const currentLevel = profile?.level || "beginner";
        if (topicPerformances.length === 0) {
            return {
                topic,
                currentLevel,
                suggestedDifficulty: currentLevel,
                averageScore: 0,
                recommendation: `No performance data for topic "${topic}". Start with ${currentLevel} difficulty.`,
            };
        }
        const avg = Math.round(topicPerformances.reduce((s, p) => s + p.score, 0) /
            topicPerformances.length);
        let suggestedDifficulty = currentLevel;
        let recommendation = "";
        if (avg >= 80) {
            suggestedDifficulty =
                currentLevel === "beginner"
                    ? "intermediate"
                    : currentLevel === "intermediate"
                        ? "advanced"
                        : "advanced";
            recommendation = `Strong performance in ${topic} (${avg}%). Try harder exercises!`;
        }
        else if (avg <= 40) {
            suggestedDifficulty =
                currentLevel === "advanced"
                    ? "intermediate"
                    : currentLevel === "intermediate"
                        ? "beginner"
                        : "beginner";
            recommendation = `Struggling with ${topic} (${avg}%). Review easier content first.`;
        }
        else {
            recommendation = `Good progress in ${topic} (${avg}%). Continue at current level.`;
        }
        return {
            topic,
            currentLevel,
            suggestedDifficulty,
            averageScore: avg,
            recommendation,
        };
    }
    async generateRecommendations(studentId) {
        const profile = await this.profileModel
            .findOne({ userId: studentId })
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException(`Profile not found for student ${studentId}`);
        }
        const currentLevel = profile.level || "beginner";
        const weaknesses = profile.weaknesses || [];
        const strengths = profile.strengths || [];
        const recentPerformances = await this.performanceModel
            .find({ studentId })
            .sort({ attemptDate: -1 })
            .limit(10)
            .exec();
        const topicScores = {};
        recentPerformances.forEach((p) => {
            const topic = p.topic || "general";
            if (!topicScores[topic]) {
                topicScores[topic] = { total: 0, count: 0 };
            }
            topicScores[topic].total += p.score;
            topicScores[topic].count++;
        });
        const weakTopicsFromPerf = Object.entries(topicScores)
            .filter(([_, s]) => Math.round(s.total / s.count) < 60)
            .map(([topic]) => topic);
        const improvedTopics = Object.entries(topicScores)
            .filter(([_, s]) => Math.round(s.total / s.count) >= 60)
            .map(([topic]) => topic);
        const allWeakTopics = [
            ...new Set([
                ...weaknesses.filter((w) => !improvedTopics.includes(w)),
                ...weakTopicsFromPerf,
            ]),
        ];
        const strongTopicsFromPerf = Object.entries(topicScores)
            .filter(([_, s]) => Math.round(s.total / s.count) >= 75)
            .map(([topic]) => topic);
        const allStrongTopics = [
            ...new Set([...strengths, ...strongTopicsFromPerf]),
        ].filter((t) => !allWeakTopics.includes(t));
        await this.recommendationModel
            .deleteMany({
            studentId,
            isViewed: false,
        })
            .exec();
        const recommendations = [];
        for (const topic of allWeakTopics.slice(0, 3)) {
            const rec = await this.recommendationModel.create({
                studentId,
                recommendedContent: `${topic} — ${currentLevel} exercises`,
                reason: this.buildWeakReason(topic, currentLevel, topicScores[topic]),
                contentType: "exercise",
                confidenceScore: this.calcConfidence(topicScores[topic], "weak"),
                isViewed: false,
                generatedAt: new Date(),
            });
            recommendations.push(rec);
        }
        if (recommendations.length < 2) {
            const rec = await this.recommendationModel.create({
                studentId,
                recommendedContent: `General ${currentLevel} practice exercises`,
                reason: `Based on your current level (${currentLevel}), these exercises will help consolidate your knowledge.`,
                contentType: "exercise",
                confidenceScore: 70,
                isViewed: false,
                generatedAt: new Date(),
            });
            recommendations.push(rec);
        }
        const nextLevel = currentLevel === "beginner"
            ? "intermediate"
            : currentLevel === "intermediate"
                ? "advanced"
                : "advanced";
        for (const topic of allStrongTopics.slice(0, 2)) {
            const rec = await this.recommendationModel.create({
                studentId,
                recommendedContent: `${topic} — ${nextLevel} challenge`,
                reason: `You are strong in ${topic}! Try ${nextLevel} exercises to push your limits.`,
                contentType: "course",
                confidenceScore: this.calcConfidence(topicScores[topic], "strong"),
                isViewed: false,
                generatedAt: new Date(),
            });
            recommendations.push(rec);
        }
        if (recommendations.length === 0) {
            const defaultTopics = ["mathematics", "sciences", "computer-science"];
            for (const topic of defaultTopics) {
                const rec = await this.recommendationModel.create({
                    studentId,
                    recommendedContent: `${topic} — ${currentLevel} starter`,
                    reason: `Start your learning journey with ${topic} at ${currentLevel} level.`,
                    contentType: "exercise",
                    confidenceScore: 60,
                    isViewed: false,
                    generatedAt: new Date(),
                });
                recommendations.push(rec);
            }
        }
        return {
            recommendations,
            profile: {
                level: currentLevel,
                weaknesses: allWeakTopics,
                strengths: allStrongTopics,
            },
            weakTopics: allWeakTopics,
            strongTopics: allStrongTopics,
            totalGenerated: recommendations.length,
        };
    }
    async generateRecommendationsV2(studentId) {
        const profile = await this.profileModel
            .findOne({ userId: studentId })
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException(`Profile not found for student ${studentId}`);
        }
        const currentLevel = profile.level || "beginner";
        const weaknesses = profile.weaknesses || [];
        const strengths = profile.strengths || [];
        const recentPerformances = await this.performanceModel
            .find({ studentId })
            .sort({ attemptDate: -1 })
            .limit(20)
            .exec();
        const latestLevelTest = await this.levelTestModel
            .findOne({ studentId, status: "completed" })
            .sort({ completedAt: -1, createdAt: -1 })
            .exec();
        const perfByTopic = {};
        [...recentPerformances].reverse().forEach((p) => {
            const topic = p.topic || "general";
            if (!perfByTopic[topic]) {
                perfByTopic[topic] = {
                    count: 0,
                    scores: [],
                    average: 0,
                    trend: "stable",
                };
            }
            perfByTopic[topic].count++;
            perfByTopic[topic].scores.push(p.score);
        });
        Object.keys(perfByTopic).forEach((topic) => {
            const stats = perfByTopic[topic];
            const avg = Math.round(stats.scores.reduce((sum, s) => sum + s, 0) / stats.scores.length);
            stats.average = avg;
            stats.trend = this.computeTrend(stats.scores);
        });
        const levelTestTopicsDetailed = [];
        const levelTestByTopic = {};
        if (latestLevelTest) {
            const strengthsDetailed = latestLevelTest.detectedStrengths || [];
            const weaknessesDetailed = latestLevelTest.detectedWeaknesses || [];
            strengthsDetailed.forEach((s) => {
                const row = {
                    topic: s.topic,
                    score: s.score,
                    correct: s.correct,
                    total: s.total,
                    source: "strength",
                };
                levelTestTopicsDetailed.push(row);
                levelTestByTopic[s.topic] = row;
            });
            weaknessesDetailed.forEach((w) => {
                const row = {
                    topic: w.topic,
                    score: w.score,
                    correct: w.correct,
                    total: w.total,
                    source: "weakness",
                };
                levelTestTopicsDetailed.push(row);
                levelTestByTopic[w.topic] = row;
            });
        }
        const allTopics = [
            ...new Set([
                ...Object.keys(perfByTopic),
                ...Object.keys(levelTestByTopic),
                ...weaknesses,
                ...strengths,
            ]),
        ];
        const topicDiagnostics = allTopics.map((topic) => {
            const perf = perfByTopic[topic];
            const test = levelTestByTopic[topic];
            const perfAvg = perf?.average ?? null;
            const trend = perf?.trend ?? "stable";
            const frequency = perf?.count ?? 0;
            const baseline = perfAvg ?? test?.score ?? 50;
            let urgencyScore = 100 - baseline;
            if (trend === "down")
                urgencyScore += 18;
            if (trend === "stable")
                urgencyScore += 6;
            if (trend === "up")
                urgencyScore -= 8;
            urgencyScore += Math.min(20, frequency * 4);
            if (test?.source === "weakness")
                urgencyScore += 15;
            if (test?.source === "strength")
                urgencyScore -= 12;
            if (test && test.score < 50)
                urgencyScore += 12;
            if (weaknesses.includes(topic))
                urgencyScore += 10;
            if (strengths.includes(topic))
                urgencyScore -= 8;
            urgencyScore = Math.max(0, Math.min(100, Math.round(urgencyScore)));
            return {
                topic,
                frequency,
                trend,
                perfAvg,
                levelTest: test || null,
                urgencyScore,
                priority: this.computePriority(urgencyScore),
            };
        });
        topicDiagnostics.sort((a, b) => b.urgencyScore - a.urgencyScore);
        await this.recommendationModel
            .deleteMany({
            studentId,
            isViewed: false,
        })
            .exec();
        const recommendations = [];
        const nextLevel = currentLevel === "beginner"
            ? "intermediate"
            : currentLevel === "intermediate"
                ? "advanced"
                : "advanced";
        for (const diag of topicDiagnostics.slice(0, 3)) {
            if (diag.urgencyScore < 35)
                continue;
            const recommendedLevel = diag.priority === "high"
                ? currentLevel
                : diag.priority === "medium"
                    ? currentLevel
                    : nextLevel;
            const payload = {
                studentId,
                recommendedContent: `${diag.topic} — ${recommendedLevel} targeted exercises`,
                reason: this.buildReasonV2(diag.topic, currentLevel, diag),
                contentType: diag.priority === "low" ? "course" : "exercise",
                confidenceScore: Math.max(60, Math.min(95, diag.urgencyScore)),
                priority: diag.priority,
                isViewed: false,
                generatedAt: new Date(),
            };
            const rec = await this.recommendationModel.create(payload);
            recommendations.push(rec);
        }
        if (recommendations.length < 2) {
            const fallbackPayload = {
                studentId,
                recommendedContent: `General ${currentLevel} consolidation plan`,
                reason: `Your profile level is ${currentLevel}. Continue with mixed exercises while we collect more topic-level evidence.`,
                contentType: "exercise",
                confidenceScore: 70,
                priority: "medium",
                isViewed: false,
                generatedAt: new Date(),
            };
            const rec = await this.recommendationModel.create(fallbackPayload);
            recommendations.push(rec);
        }
        return {
            recommendations,
            profile: {
                level: currentLevel,
                weaknesses,
                strengths,
            },
            insights: {
                topicsAnalyzed: allTopics.length,
                levelTestTopicsDetailed,
                topicDiagnostics,
            },
            totalGenerated: recommendations.length,
        };
    }
    async getLearningPath(studentId) {
        const profile = await this.profileModel
            .findOne({ userId: studentId })
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException(`Profile not found for student ${studentId}`);
        }
        const currentLevel = profile.level || "beginner";
        const targetLevel = currentLevel === "beginner"
            ? "intermediate"
            : currentLevel === "intermediate"
                ? "advanced"
                : "advanced";
        const weaknesses = profile.weaknesses || [];
        const strengths = profile.strengths || [];
        const recentPerformances = await this.performanceModel
            .find({ studentId })
            .sort({ attemptDate: -1 })
            .limit(20)
            .exec();
        const latestLevelTest = await this.levelTestModel
            .findOne({ studentId, status: "completed" })
            .sort({ completedAt: -1, createdAt: -1 })
            .exec();
        const perfByTopic = {};
        recentPerformances.forEach((p) => {
            const topic = p.topic || "general";
            if (!perfByTopic[topic]) {
                perfByTopic[topic] = { avg: 0, latest: p.score, count: 0 };
            }
            perfByTopic[topic].count++;
            perfByTopic[topic].avg += p.score;
        });
        Object.keys(perfByTopic).forEach((topic) => {
            const item = perfByTopic[topic];
            item.avg = Math.round(item.avg / item.count);
        });
        const levelTestWeak = (latestLevelTest?.detectedWeaknesses || []).map((w) => w.topic);
        const levelTestStrong = (latestLevelTest?.detectedStrengths || []).map((s) => s.topic);
        const lowPerfTopics = Object.entries(perfByTopic)
            .filter(([_, stat]) => stat.avg < 60)
            .map(([topic]) => topic);
        const mediumPerfTopics = Object.entries(perfByTopic)
            .filter(([_, stat]) => stat.avg >= 60 && stat.avg < 75)
            .map(([topic]) => topic);
        const allTopics = [
            ...new Set([
                ...weaknesses,
                ...levelTestWeak,
                ...lowPerfTopics,
                ...mediumPerfTopics,
                ...strengths,
                ...levelTestStrong,
            ]),
        ];
        const ranked = allTopics.map((topic) => {
            const perf = perfByTopic[topic];
            const avg = perf?.avg;
            const latest = perf?.latest;
            const isWeak = weaknesses.includes(topic) ||
                levelTestWeak.includes(topic) ||
                (typeof avg === "number" && avg < 60);
            const isStrong = strengths.includes(topic) ||
                levelTestStrong.includes(topic) ||
                (typeof avg === "number" && avg >= 75);
            const priority = isWeak
                ? "high"
                : isStrong
                    ? "low"
                    : "medium";
            const status = typeof latest === "number" && latest >= 70
                ? "completed"
                : typeof latest === "number" && latest >= 50
                    ? "in-progress"
                    : "pending";
            let action = `Practice ${topic} at ${currentLevel} level.`;
            if (priority === "high") {
                action = `Reinforce ${topic} fundamentals with guided exercises, then solve a short quiz.`;
            }
            else if (priority === "medium") {
                action = `Consolidate ${topic} with mixed exercises and one mini-project.`;
            }
            else {
                action = `Advance ${topic} with challenge tasks to prepare for ${targetLevel}.`;
            }
            return {
                topic,
                priority,
                status,
                action,
                scoreHint: typeof avg === "number" ? avg : 50,
            };
        });
        ranked.sort((a, b) => {
            const weight = { high: 3, medium: 2, low: 1 };
            if (weight[b.priority] !== weight[a.priority]) {
                return weight[b.priority] - weight[a.priority];
            }
            return a.scoreHint - b.scoreHint;
        });
        const steps = ranked.map((item, index) => ({
            order: index + 1,
            topic: item.topic,
            action: item.action,
            priority: item.priority,
            status: item.status,
        }));
        const pendingHighCount = steps.filter((s) => s.priority === "high" && s.status !== "completed").length;
        const pendingMediumCount = steps.filter((s) => s.priority === "medium" && s.status !== "completed").length;
        const baseWeeks = currentLevel === "beginner" ? 8 : currentLevel === "intermediate" ? 6 : 4;
        const estimatedWeeks = Math.max(2, baseWeeks + pendingHighCount * 2 + pendingMediumCount);
        return {
            currentLevel,
            targetLevel,
            estimatedWeeks,
            steps,
        };
    }
    async getWeakAreaRecommendations(studentId) {
        const profile = await this.profileModel
            .findOne({ userId: studentId })
            .exec();
        if (!profile) {
            throw new common_1.NotFoundException(`Profile not found for student ${studentId}`);
        }
        const profileWeaknesses = profile.weaknesses || [];
        const latestLevelTest = await this.levelTestModel
            .findOne({ studentId, status: "completed" })
            .sort({ completedAt: -1, createdAt: -1 })
            .exec();
        const recentPerformances = await this.performanceModel
            .find({ studentId })
            .sort({ attemptDate: -1 })
            .limit(20)
            .exec();
        const topicScoresFromPerf = {};
        recentPerformances.forEach((p) => {
            const topic = p.topic || "general";
            if (!topicScoresFromPerf[topic]) {
                topicScoresFromPerf[topic] = { total: 0, count: 0 };
            }
            topicScoresFromPerf[topic].total += p.score;
            topicScoresFromPerf[topic].count++;
        });
        const weakFromPerformance = Object.entries(topicScoresFromPerf)
            .map(([topic, stat]) => ({
            topic,
            score: Math.round(stat.total / stat.count),
        }))
            .filter((item) => item.score < 60);
        const weakFromLevelTest = (latestLevelTest?.detectedWeaknesses || []).map((w) => ({
            topic: w.topic,
            score: typeof w.score === "number" ? w.score : 50,
        }));
        const mergedWeakAreas = new Map();
        const upsertWeakArea = (topic, score, source) => {
            const normalizedTopic = (topic || "general").trim();
            if (!normalizedTopic)
                return;
            const safeScore = Math.max(0, Math.min(100, Math.round(score)));
            const existing = mergedWeakAreas.get(normalizedTopic);
            if (!existing || safeScore < existing.currentScore) {
                mergedWeakAreas.set(normalizedTopic, {
                    topic: normalizedTopic,
                    currentScore: safeScore,
                    source,
                });
            }
        };
        weakFromLevelTest.forEach((item) => {
            upsertWeakArea(item.topic, item.score, "level-test");
        });
        weakFromPerformance.forEach((item) => {
            upsertWeakArea(item.topic, item.score, "performance");
        });
        profileWeaknesses.forEach((topic) => {
            upsertWeakArea(topic, 55, "profile");
        });
        const weakAreas = Array.from(mergedWeakAreas.values())
            .sort((a, b) => a.currentScore - b.currentScore)
            .slice(0, 5)
            .map((item) => {
            const suggestedDifficulty = item.currentScore < 30
                ? "easy"
                : item.currentScore <= 60
                    ? "medium"
                    : "hard";
            const action = `Complete a targeted ${suggestedDifficulty} remediation exercise in ${item.topic}, then retry a short quiz to validate progress.`;
            const encouragement = item.currentScore < 30
                ? `You can improve ${item.topic} step by step. Start small, stay consistent, and your score will rise.`
                : item.currentScore <= 60
                    ? `You are close to mastering ${item.topic}. Focused practice will quickly move you forward.`
                    : `Great momentum in ${item.topic}. Take on harder remediation tasks to secure full mastery.`;
            return {
                topic: item.topic,
                currentScore: item.currentScore,
                suggestedDifficulty,
                action,
                encouragement,
                source: item.source,
            };
        });
        return {
            weakAreas,
            totalWeakAreas: weakAreas.length,
            mostUrgent: weakAreas[0]?.topic || "",
        };
    }
    async getExerciseCompletionTracking(studentId) {
        const attempts = await this.performanceModel
            .find({ studentId })
            .sort({ attemptDate: -1 })
            .exec();
        const totalAttempts = attempts.length;
        const totalCompleted = attempts.filter((a) => a.score >= 70).length;
        const totalTimeSpent = attempts.reduce((sum, a) => sum + (Number(a.timeSpent) || 0), 0);
        const averageScore = totalAttempts > 0
            ? Math.round((attempts.reduce((sum, a) => sum + a.score, 0) /
                totalAttempts) *
                100) / 100
            : 0;
        const completionRate = totalAttempts > 0
            ? Math.round((totalCompleted / totalAttempts) * 10000) / 100
            : 0;
        const topicStats = {};
        attempts.forEach((a) => {
            const topic = a.topic || "general";
            if (!topicStats[topic]) {
                topicStats[topic] = {
                    attempts: 0,
                    completed: 0,
                    totalScore: 0,
                    totalTimeSpent: 0,
                    lastAttemptDate: a.attemptDate,
                };
            }
            topicStats[topic].attempts++;
            if (a.score >= 70)
                topicStats[topic].completed++;
            topicStats[topic].totalScore += a.score;
            topicStats[topic].totalTimeSpent += Number(a.timeSpent) || 0;
            if (a.attemptDate &&
                (!topicStats[topic].lastAttemptDate ||
                    new Date(a.attemptDate) > new Date(topicStats[topic].lastAttemptDate))) {
                topicStats[topic].lastAttemptDate = a.attemptDate;
            }
        });
        const byTopic = Object.entries(topicStats)
            .map(([topic, stat]) => ({
            topic,
            attempts: stat.attempts,
            completed: stat.completed,
            completionRate: stat.attempts > 0
                ? Math.round((stat.completed / stat.attempts) * 10000) / 100
                : 0,
            averageScore: stat.attempts > 0
                ? Math.round((stat.totalScore / stat.attempts) * 100) / 100
                : 0,
            totalTimeSpent: stat.totalTimeSpent,
            lastAttemptDate: stat.lastAttemptDate,
        }))
            .sort((a, b) => b.attempts - a.attempts);
        const difficultySeed = {
            beginner: { attempts: 0, completed: 0, totalScore: 0 },
            intermediate: { attempts: 0, completed: 0, totalScore: 0 },
            advanced: { attempts: 0, completed: 0, totalScore: 0 },
        };
        attempts.forEach((a) => {
            const difficulty = a.difficulty;
            if (difficulty !== "beginner" &&
                difficulty !== "intermediate" &&
                difficulty !== "advanced") {
                return;
            }
            difficultySeed[difficulty].attempts++;
            if (a.score >= 70)
                difficultySeed[difficulty].completed++;
            difficultySeed[difficulty].totalScore += a.score;
        });
        const byDifficulty = {
            beginner: {
                attempts: difficultySeed.beginner.attempts,
                completed: difficultySeed.beginner.completed,
                completionRate: difficultySeed.beginner.attempts > 0
                    ? Math.round((difficultySeed.beginner.completed /
                        difficultySeed.beginner.attempts) *
                        10000) / 100
                    : 0,
                averageScore: difficultySeed.beginner.attempts > 0
                    ? Math.round((difficultySeed.beginner.totalScore /
                        difficultySeed.beginner.attempts) *
                        100) / 100
                    : 0,
            },
            intermediate: {
                attempts: difficultySeed.intermediate.attempts,
                completed: difficultySeed.intermediate.completed,
                completionRate: difficultySeed.intermediate.attempts > 0
                    ? Math.round((difficultySeed.intermediate.completed /
                        difficultySeed.intermediate.attempts) *
                        10000) / 100
                    : 0,
                averageScore: difficultySeed.intermediate.attempts > 0
                    ? Math.round((difficultySeed.intermediate.totalScore /
                        difficultySeed.intermediate.attempts) *
                        100) / 100
                    : 0,
            },
            advanced: {
                attempts: difficultySeed.advanced.attempts,
                completed: difficultySeed.advanced.completed,
                completionRate: difficultySeed.advanced.attempts > 0
                    ? Math.round((difficultySeed.advanced.completed /
                        difficultySeed.advanced.attempts) *
                        10000) / 100
                    : 0,
                averageScore: difficultySeed.advanced.attempts > 0
                    ? Math.round((difficultySeed.advanced.totalScore /
                        difficultySeed.advanced.attempts) *
                        100) / 100
                    : 0,
            },
        };
        const recentActivity = attempts.slice(0, 5).map((a) => ({
            exerciseId: String(a.exerciseId || ""),
            topic: a.topic || "general",
            score: a.score,
            difficulty: a.difficulty || "unknown",
            date: a.attemptDate,
            status: a.score >= 70 ? "passed" : "failed",
        }));
        const uniqueDays = new Set();
        attempts.forEach((a) => {
            if (!a.attemptDate)
                return;
            const d = new Date(a.attemptDate);
            const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            uniqueDays.add(dayKey);
        });
        let currentStreak = 0;
        if (uniqueDays.size > 0) {
            const sortedDaysDesc = Array.from(uniqueDays)
                .map((s) => new Date(`${s}T00:00:00.000Z`))
                .sort((a, b) => b.getTime() - a.getTime());
            currentStreak = 1;
            for (let i = 1; i < sortedDaysDesc.length; i++) {
                const previous = sortedDaysDesc[i - 1].getTime();
                const current = sortedDaysDesc[i].getTime();
                const diffDays = Math.round((previous - current) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    currentStreak++;
                }
                else {
                    break;
                }
            }
        }
        return {
            summary: {
                totalAttempts,
                totalCompleted,
                completionRate,
                totalTimeSpent,
                currentStreak,
                averageScore,
            },
            byTopic,
            byDifficulty,
            recentActivity,
        };
    }
    async getLearningVelocity(studentId) {
        const performances = await this.performanceModel
            .find({ studentId })
            .sort({ attemptDate: 1 })
            .exec();
        if (performances.length === 0) {
            return {
                globalVelocity: 0,
                learningPace: "slow",
                consistencyScore: 0,
                weeklyProgress: 0,
                byTopic: [],
                recommendation: "No performance data yet. Complete a few sessions across the week to start tracking your learning velocity.",
            };
        }
        const weeklyScores = new Map();
        performances.forEach((p) => {
            const weekKey = this.getWeekStartKey(new Date(p.attemptDate));
            if (!weeklyScores.has(weekKey)) {
                weeklyScores.set(weekKey, []);
            }
            weeklyScores.get(weekKey).push(p.score);
        });
        const weeklyAverages = Array.from(weeklyScores.entries())
            .map(([week, scores]) => ({
            week,
            avg: scores.length > 0
                ? scores.reduce((sum, s) => sum + s, 0) / scores.length
                : 0,
        }))
            .sort((a, b) => (a.week < b.week ? -1 : 1));
        const activeWeeks = Math.max(1, weeklyAverages.length);
        const firstWeekScore = weeklyAverages[0]?.avg ?? 0;
        const lastWeekScore = weeklyAverages[weeklyAverages.length - 1]?.avg ?? 0;
        const weeklyProgress = Math.round((lastWeekScore - firstWeekScore) * 100) / 100;
        const globalVelocity = Math.round((weeklyProgress / activeWeeks) * 100) / 100;
        const learningPace = globalVelocity < 0
            ? "declining"
            : globalVelocity >= 5
                ? "fast"
                : globalVelocity >= 1
                    ? "normal"
                    : "slow";
        const scores = performances.map((p) => p.score);
        const sessionsPerWeek = performances.length / activeWeeks;
        const frequencyScore = Math.min(100, (sessionsPerWeek / 3) * 100);
        const stdDev = this.calculateStandardDeviation(scores);
        const stabilityScore = Math.max(0, 100 - stdDev * 3.33);
        const consistencyScore = Math.round((frequencyScore * 0.5 + stabilityScore * 0.5) * 100) / 100;
        const topicBuckets = new Map();
        performances.forEach((p) => {
            const topic = (p.topic || "general").trim() || "general";
            if (!topicBuckets.has(topic)) {
                topicBuckets.set(topic, []);
            }
            topicBuckets.get(topic).push(p);
        });
        const byTopic = Array.from(topicBuckets.entries())
            .filter(([_, rows]) => rows.length >= 2)
            .map(([topic, rows]) => {
            const sorted = [...rows].sort((a, b) => new Date(a.attemptDate).getTime() -
                new Date(b.attemptDate).getTime());
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const firstScore = Number(first.score) || 0;
            const lastScore = Number(last.score) || 0;
            const improvement = Math.round((lastScore - firstScore) * 100) / 100;
            const diffMs = new Date(last.attemptDate).getTime() -
                new Date(first.attemptDate).getTime();
            const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
            const velocity = Math.round((improvement / days) * 100) / 100;
            return {
                topic,
                velocity,
                firstScore,
                lastScore,
                improvement,
                sessionsCount: sorted.length,
            };
        })
            .sort((a, b) => b.velocity - a.velocity);
        const recommendation = this.buildVelocityRecommendation(learningPace, consistencyScore, byTopic);
        return {
            globalVelocity,
            learningPace,
            consistencyScore,
            weeklyProgress,
            byTopic,
            recommendation,
        };
    }
    async getAchievementBadges(studentId) {
        const [performances, profile, completedLevelTest, velocity] = await Promise.all([
            this.performanceModel
                .find({ studentId })
                .sort({ attemptDate: 1 })
                .exec(),
            this.profileModel.findOne({ userId: studentId }).exec(),
            this.levelTestModel.findOne({ studentId, status: "completed" }).exec(),
            this.getLearningVelocity(studentId),
        ]);
        const totalExercises = performances.length;
        const scores = performances.map((p) => Number(p.score) || 0);
        const avgScore = scores.length > 0
            ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) *
                100) / 100
            : 0;
        const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
        const uniqueTopics = new Set(performances.map((p) => (p.topic || "general").trim() || "general"));
        const streakInfo = this.computeLongestStreak(performances);
        const maxStreak = streakInfo.maxStreak;
        const topicStats = this.computeTopicStats(performances);
        const maxTopicAverage = Object.values(topicStats).reduce((max, item) => {
            return Math.max(max, item.average);
        }, 0);
        const weaknessImprovement = this.computeWeaknessImprovement(topicStats);
        const comeback = this.computeComeback(performances);
        const levelSignals = this.collectLevelSignals(performances, completedLevelTest, profile);
        const levelUpEarned = levelSignals.minRank !== null &&
            levelSignals.maxRank !== null &&
            levelSignals.maxRank > levelSignals.minRank;
        const levelUpProgress = levelSignals.minRank !== null && levelSignals.maxRank !== null
            ? Math.min(100, Math.round(((levelSignals.maxRank - levelSignals.minRank) / 1) * 100))
            : 0;
        const badgeMeta = [
            {
                id: "first_exercise",
                name: "First Exercise",
                description: "Complete at least one exercise.",
                icon: "play_circle",
                category: "performance",
                earned: totalExercises >= 1,
                earnedAt: totalExercises >= 1
                    ? new Date(performances[0].attemptDate)
                    : undefined,
                progress: Math.min(100, totalExercises * 100),
            },
            {
                id: "perfect_score",
                name: "Perfect Score",
                description: "Get 100% on an exercise.",
                icon: "stars",
                category: "performance",
                earned: maxScore >= 100,
                earnedAt: maxScore >= 100
                    ? this.findEarnedAtByScoreThreshold(performances, 100)
                    : undefined,
                progress: Math.min(100, maxScore),
            },
            {
                id: "high_achiever",
                name: "High Achiever",
                description: "Reach an average score of at least 80% over 5+ exercises.",
                icon: "emoji_events",
                category: "performance",
                earned: totalExercises >= 5 && avgScore >= 80,
                earnedAt: totalExercises >= 5 && avgScore >= 80
                    ? new Date(performances[Math.min(4, performances.length - 1)].attemptDate)
                    : undefined,
                progress: Math.round((Math.min(100, (totalExercises / 5) * 100) * 0.4 +
                    Math.min(100, (avgScore / 80) * 100) * 0.6) *
                    100) / 100,
            },
            {
                id: "consistency_king",
                name: "Consistency King",
                description: "Be active for 3 consecutive days.",
                icon: "calendar_month",
                category: "performance",
                earned: maxStreak >= 3,
                earnedAt: maxStreak >= 3 ? streakInfo.earnedAt : undefined,
                progress: Math.min(100, Math.round((maxStreak / 3) * 100)),
            },
            {
                id: "level_up",
                name: "Level Up",
                description: "Increase your level at least once.",
                icon: "trending_up",
                category: "progress",
                earned: levelUpEarned,
                earnedAt: levelUpEarned ? levelSignals.firstUpgradeAt : undefined,
                progress: levelUpProgress,
            },
            {
                id: "speed_learner",
                name: "Speed Learner",
                description: "Reach a learning velocity above 5 points/week.",
                icon: "bolt",
                category: "progress",
                earned: velocity.globalVelocity > 5,
                earnedAt: velocity.globalVelocity > 5 && performances.length > 0
                    ? new Date(performances[performances.length - 1].attemptDate)
                    : undefined,
                progress: Math.max(0, Math.min(100, Math.round((velocity.globalVelocity / 5) * 100))),
            },
            {
                id: "comeback_kid",
                name: "Comeback Kid",
                description: "Drop in score, then recover by at least 20 points.",
                icon: "autorenew",
                category: "progress",
                earned: comeback.earned,
                earnedAt: comeback.earnedAt,
                progress: Math.min(100, Math.round((comeback.bestRebound / 20) * 100)),
            },
            {
                id: "topic_master",
                name: "Topic Master",
                description: "Get at least 90% average in one topic.",
                icon: "workspace_premium",
                category: "topic",
                earned: maxTopicAverage >= 90,
                earnedAt: maxTopicAverage >= 90
                    ? new Date(performances[performances.length - 1].attemptDate)
                    : undefined,
                progress: Math.min(100, Math.round((maxTopicAverage / 90) * 100)),
            },
            {
                id: "well_rounded",
                name: "Well Rounded",
                description: "Practice at least 4 different topics.",
                icon: "category",
                category: "topic",
                earned: uniqueTopics.size >= 4,
                earnedAt: uniqueTopics.size >= 4 && performances.length > 0
                    ? this.findEarnedAtByUniqueTopics(performances, 4)
                    : undefined,
                progress: Math.min(100, Math.round((uniqueTopics.size / 4) * 100)),
            },
            {
                id: "weakness_crusher",
                name: "Weakness Crusher",
                description: "Improve a weak topic by at least 30 points.",
                icon: "construction",
                category: "topic",
                earned: weaknessImprovement.bestImprovement >= 30,
                earnedAt: weaknessImprovement.bestImprovement >= 30
                    ? weaknessImprovement.earnedAt
                    : undefined,
                progress: Math.min(100, Math.round((weaknessImprovement.bestImprovement / 30) * 100)),
            },
            {
                id: "rookie",
                name: "Rookie",
                description: "Complete your first exercise milestone.",
                icon: "flag",
                category: "milestone",
                earned: totalExercises >= 1,
                earnedAt: totalExercises >= 1
                    ? new Date(performances[0].attemptDate)
                    : undefined,
                progress: Math.min(100, totalExercises * 100),
            },
            {
                id: "dedicated",
                name: "Dedicated",
                description: "Complete 10 exercises.",
                icon: "local_fire_department",
                category: "milestone",
                earned: totalExercises >= 10,
                earnedAt: totalExercises >= 10
                    ? new Date(performances[9].attemptDate)
                    : undefined,
                progress: Math.min(100, Math.round((totalExercises / 10) * 100)),
            },
            {
                id: "veteran",
                name: "Veteran",
                description: "Complete 25 exercises.",
                icon: "military_tech",
                category: "milestone",
                earned: totalExercises >= 25,
                earnedAt: totalExercises >= 25
                    ? new Date(performances[24].attemptDate)
                    : undefined,
                progress: Math.min(100, Math.round((totalExercises / 25) * 100)),
            },
            {
                id: "level_test_hero",
                name: "Level Test Hero",
                description: "Complete the level test.",
                icon: "quiz",
                category: "milestone",
                earned: !!completedLevelTest,
                earnedAt: completedLevelTest
                    ? new Date(completedLevelTest.completedAt ||
                        completedLevelTest.createdAt)
                    : undefined,
                progress: completedLevelTest ? 100 : 0,
            },
            {
                id: "streak_3",
                name: "Streak 3",
                description: "Reach a 3-day activity streak.",
                icon: "whatshot",
                category: "milestone",
                earned: maxStreak >= 3,
                earnedAt: maxStreak >= 3 ? streakInfo.earnedAt : undefined,
                progress: Math.min(100, Math.round((maxStreak / 3) * 100)),
            },
        ];
        const badges = badgeMeta.map((badge) => {
            if (badge.earned) {
                const { progress, ...earnedBadge } = badge;
                return earnedBadge;
            }
            return {
                ...badge,
                progress: Math.max(0, Math.min(100, Math.round(badge.progress || 0))),
            };
        });
        const earnedBadges = badges.filter((b) => b.earned).length;
        const totalBadges = badges.length;
        const completionRate = totalBadges > 0
            ? Math.round((earnedBadges / totalBadges) * 10000) / 100
            : 0;
        return {
            totalBadges,
            earnedBadges,
            completionRate,
            badges,
        };
    }
    computeTrend(scores) {
        if (scores.length < 2)
            return "stable";
        const first = scores[0];
        const last = scores[scores.length - 1];
        const delta = last - first;
        if (delta >= 8)
            return "up";
        if (delta <= -8)
            return "down";
        return "stable";
    }
    computePriority(urgencyScore) {
        if (urgencyScore >= 70)
            return "high";
        if (urgencyScore >= 45)
            return "medium";
        return "low";
    }
    buildReasonV2(topic, level, diag) {
        const perfPart = diag.perfAvg === null
            ? `No recent performance average available for ${topic}.`
            : `Recent average in ${topic} is ${diag.perfAvg}%.`;
        const trendPart = diag.trend === "up"
            ? `Trend is improving.`
            : diag.trend === "down"
                ? `Trend is declining.`
                : `Trend is stable.`;
        const frequencyPart = `Topic frequency in recent attempts: ${diag.frequency}.`;
        const levelTestPart = diag.levelTest
            ? `Level test detail: ${diag.levelTest.correct}/${diag.levelTest.total} correct (${diag.levelTest.score}%), tagged as ${diag.levelTest.source}.`
            : `No detailed level test stat found for this topic.`;
        return (`${perfPart} ${trendPart} ${frequencyPart} ${levelTestPart} ` +
            `Priority is ${diag.priority}. Recommended action: ${topic} at ${level} focus.`);
    }
    buildWeakReason(topic, level, stat) {
        if (stat && stat.count > 0) {
            const avg = Math.round(stat.total / stat.count);
            return (`Your average score in ${topic} is ${avg}%. ` +
                `Practice more ${level} exercises to improve this area.`);
        }
        return (`${topic} was detected as a weak area in your ` +
            `level test. Focus on ${level} exercises to improve.`);
    }
    calcConfidence(stat, type) {
        if (!stat || stat.count === 0)
            return 65;
        const avg = Math.round(stat.total / stat.count);
        if (type === "weak") {
            return Math.min(95, 100 - avg);
        }
        return Math.min(95, avg);
    }
    getWeekStartKey(date) {
        const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const day = utcDate.getUTCDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        utcDate.setUTCDate(utcDate.getUTCDate() + diffToMonday);
        return utcDate.toISOString().slice(0, 10);
    }
    calculateStandardDeviation(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    buildVelocityRecommendation(learningPace, consistencyScore, byTopic = []) {
        const bestTopic = byTopic[0];
        const worstTopic = [...byTopic].sort((a, b) => a.velocity - b.velocity)[0];
        if (learningPace === "declining") {
            return (`Your recent trajectory is declining. Reduce difficulty temporarily and ` +
                `focus on fundamentals${worstTopic ? ` in ${worstTopic.topic}` : ""}. ` +
                `Aim for 3+ focused sessions per week to recover momentum.`);
        }
        if (learningPace === "fast") {
            return (`Excellent momentum. Keep your routine and add challenge exercises` +
                `${bestTopic ? ` in ${bestTopic.topic}` : ""} to sustain growth.`);
        }
        if (consistencyScore < 60) {
            return (`Progress is present but inconsistent. Spread sessions across the week ` +
                `and keep score variation controlled for steadier improvement.`);
        }
        if (learningPace === "normal") {
            return (`You are progressing at a healthy pace. Maintain your current rhythm and ` +
                `gradually increase difficulty to keep improving.`);
        }
        return (`Your progress is currently slow. Increase weekly practice frequency and ` +
            `review weak concepts before moving to harder content.`);
    }
    findEarnedAtByScoreThreshold(performances, threshold) {
        const item = performances.find((p) => Number(p.score) >= threshold);
        return item?.attemptDate ? new Date(item.attemptDate) : undefined;
    }
    findEarnedAtByUniqueTopics(performances, targetCount) {
        const topicSet = new Set();
        for (const p of performances) {
            const topic = (p.topic || "general").trim() || "general";
            topicSet.add(topic);
            if (topicSet.size >= targetCount) {
                return p.attemptDate ? new Date(p.attemptDate) : undefined;
            }
        }
        return undefined;
    }
    computeLongestStreak(performances) {
        if (performances.length === 0) {
            return { maxStreak: 0 };
        }
        const uniqueDays = Array.from(new Set(performances.map((p) => {
            const d = new Date(p.attemptDate);
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        })))
            .map((day) => new Date(`${day}T00:00:00.000Z`))
            .sort((a, b) => a.getTime() - b.getTime());
        if (uniqueDays.length === 0)
            return { maxStreak: 0 };
        let maxStreak = 1;
        let currentStreak = 1;
        let earnedAt;
        for (let i = 1; i < uniqueDays.length; i++) {
            const prev = uniqueDays[i - 1].getTime();
            const current = uniqueDays[i].getTime();
            const diffDays = Math.round((current - prev) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                currentStreak++;
            }
            else {
                currentStreak = 1;
            }
            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
            }
            if (!earnedAt && currentStreak >= 3) {
                earnedAt = uniqueDays[i];
            }
        }
        return { maxStreak, earnedAt };
    }
    computeTopicStats(performances) {
        const bucket = {};
        performances.forEach((p) => {
            const topic = (p.topic || "general").trim() || "general";
            if (!bucket[topic])
                bucket[topic] = [];
            bucket[topic].push(p);
        });
        const stats = {};
        Object.keys(bucket).forEach((topic) => {
            const sorted = [...bucket[topic]].sort((a, b) => new Date(a.attemptDate).getTime() - new Date(b.attemptDate).getTime());
            const scores = sorted.map((p) => Number(p.score) || 0);
            const avg = scores.length > 0
                ? scores.reduce((sum, s) => sum + s, 0) /
                    scores.length
                : 0;
            stats[topic] = {
                firstScore: scores[0] || 0,
                lastScore: scores[scores.length - 1] || 0,
                average: Math.round(avg * 100) / 100,
                scores,
                firstDate: sorted[0]?.attemptDate
                    ? new Date(sorted[0].attemptDate)
                    : undefined,
                lastDate: sorted[sorted.length - 1]?.attemptDate
                    ? new Date(sorted[sorted.length - 1].attemptDate)
                    : undefined,
            };
        });
        return stats;
    }
    computeWeaknessImprovement(topicStats) {
        let bestImprovement = 0;
        let earnedAt;
        Object.keys(topicStats).forEach((topic) => {
            const stat = topicStats[topic];
            if (stat.firstScore < 60) {
                const improvement = stat.lastScore - stat.firstScore;
                if (improvement > bestImprovement) {
                    bestImprovement = improvement;
                    earnedAt = stat.lastDate;
                }
            }
        });
        return {
            bestImprovement: Math.round(bestImprovement * 100) / 100,
            earnedAt,
        };
    }
    computeComeback(performances) {
        const scores = performances.map((p) => Number(p.score) || 0);
        if (scores.length < 3) {
            return { earned: false, bestRebound: 0 };
        }
        let bestRebound = 0;
        let earnedAt;
        for (let i = 1; i < scores.length - 1; i++) {
            const beforePeak = Math.max(...scores.slice(0, i));
            const valley = scores[i];
            const futurePeak = Math.max(...scores.slice(i + 1));
            const dropped = beforePeak - valley;
            const rebound = futurePeak - valley;
            if (dropped > 0 && rebound > bestRebound) {
                bestRebound = rebound;
            }
            if (!earnedAt && dropped > 0 && rebound >= 20) {
                const reboundItem = performances
                    .slice(i + 1)
                    .find((p) => Number(p.score) === futurePeak);
                earnedAt = reboundItem?.attemptDate
                    ? new Date(reboundItem.attemptDate)
                    : undefined;
            }
        }
        return {
            earned: bestRebound >= 20,
            bestRebound: Math.round(bestRebound * 100) / 100,
            earnedAt,
        };
    }
    collectLevelSignals(performances, completedLevelTest, profile) {
        const rankMap = {
            beginner: 1,
            intermediate: 2,
            advanced: 3,
        };
        const signals = [];
        performances.forEach((p) => {
            const difficulty = String(p.difficulty || "").toLowerCase();
            if (rankMap[difficulty]) {
                signals.push({
                    rank: rankMap[difficulty],
                    at: p.attemptDate ? new Date(p.attemptDate) : undefined,
                });
            }
        });
        if (completedLevelTest?.resultLevel) {
            const level = String(completedLevelTest.resultLevel).toLowerCase();
            if (rankMap[level]) {
                signals.push({
                    rank: rankMap[level],
                    at: completedLevelTest.completedAt
                        ? new Date(completedLevelTest.completedAt)
                        : completedLevelTest.createdAt
                            ? new Date(completedLevelTest.createdAt)
                            : undefined,
                });
            }
        }
        if (profile?.level) {
            const level = String(profile.level).toLowerCase();
            if (rankMap[level]) {
                signals.push({ rank: rankMap[level], at: undefined });
            }
        }
        if (signals.length === 0) {
            return { minRank: null, maxRank: null };
        }
        const sortedByDate = [...signals].sort((a, b) => {
            const aTime = a.at?.getTime() || 0;
            const bTime = b.at?.getTime() || 0;
            return aTime - bTime;
        });
        let baseline = sortedByDate[0].rank;
        let firstUpgradeAt;
        for (const signal of sortedByDate) {
            if (signal.rank > baseline) {
                firstUpgradeAt = signal.at;
                break;
            }
            baseline = Math.min(baseline, signal.rank);
        }
        const allRanks = signals.map((s) => s.rank);
        return {
            minRank: Math.min(...allRanks),
            maxRank: Math.max(...allRanks),
            firstUpgradeAt,
        };
    }
    async createRecommendation(dto) {
        const recommendation = new this.recommendationModel(dto);
        return recommendation.save();
    }
    async findRecommendationsByStudent(studentId) {
        return this.recommendationModel
            .find({ studentId })
            .sort({ generatedAt: -1 })
            .exec();
    }
    async markRecommendationViewed(id) {
        const rec = await this.recommendationModel
            .findByIdAndUpdate(id, { isViewed: true }, { new: true })
            .exec();
        if (!rec)
            throw new common_1.NotFoundException(`Recommendation ${id} not found`);
        return rec;
    }
    async deleteRecommendation(id) {
        await this.recommendationModel.findByIdAndDelete(id).exec();
    }
    async createQuestion(dto) {
        const question = new this.questionModel(dto);
        return question.save();
    }
    async findAllQuestions() {
        return this.questionModel.find().exec();
    }
    async createLevelTest(studentId) {
        const beginnerQs = await this.questionModel.aggregate([
            { $match: { difficulty: "beginner" } },
            { $sample: { size: 5 } },
        ]);
        const intermediateQs = await this.questionModel.aggregate([
            { $match: { difficulty: "intermediate" } },
            { $sample: { size: 8 } },
        ]);
        const advancedQs = await this.questionModel.aggregate([
            { $match: { difficulty: "advanced" } },
            { $sample: { size: 7 } },
        ]);
        let selectedQuestions = [...beginnerQs, ...intermediateQs, ...advancedQs];
        if (selectedQuestions.length === 0) {
            selectedQuestions = [
                {
                    questionText: "What does OOP stand for?",
                    options: [
                        "Object Oriented Programming",
                        "Open Object Processing",
                        "Ordered Output Program",
                        "None",
                    ],
                    correctAnswer: "Object Oriented Programming",
                    topic: "OOP",
                    difficulty: "beginner",
                },
                {
                    questionText: "What is a variable in programming?",
                    options: [
                        "A fixed value",
                        "A storage location with a name",
                        "A function",
                        "A loop",
                    ],
                    correctAnswer: "A storage location with a name",
                    topic: "programming",
                    difficulty: "beginner",
                },
                {
                    questionText: "What does HTML stand for?",
                    options: [
                        "Hyper Text Markup Language",
                        "High Tech Modern Language",
                        "Hyper Transfer Markup Language",
                        "None",
                    ],
                    correctAnswer: "Hyper Text Markup Language",
                    topic: "web",
                    difficulty: "beginner",
                },
                {
                    questionText: "What is a primary key in databases?",
                    options: [
                        "A unique identifier for each record",
                        "The first column",
                        "An encrypted field",
                        "A foreign reference",
                    ],
                    correctAnswer: "A unique identifier for each record",
                    topic: "databases",
                    difficulty: "beginner",
                },
                {
                    questionText: "What is a loop in programming?",
                    options: [
                        "A condition",
                        "A repeated execution block",
                        "A variable",
                        "A function call",
                    ],
                    correctAnswer: "A repeated execution block",
                    topic: "programming",
                    difficulty: "beginner",
                },
                {
                    questionText: "What is CSS used for?",
                    options: [
                        "Database management",
                        "Styling web pages",
                        "Server logic",
                        "Algorithms",
                    ],
                    correctAnswer: "Styling web pages",
                    topic: "web",
                    difficulty: "beginner",
                },
                {
                    questionText: "What is the time complexity of binary search?",
                    options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
                    correctAnswer: "O(log n)",
                    topic: "algorithms",
                    difficulty: "intermediate",
                },
                {
                    questionText: "What is inheritance in OOP?",
                    options: [
                        "Copying code",
                        "A class acquiring properties of another",
                        "A loop structure",
                        "A data type",
                    ],
                    correctAnswer: "A class acquiring properties of another",
                    topic: "OOP",
                    difficulty: "intermediate",
                },
                {
                    questionText: "What is a REST API?",
                    options: [
                        "A database",
                        "An architectural style for web services",
                        "A programming language",
                        "A UI framework",
                    ],
                    correctAnswer: "An architectural style for web services",
                    topic: "web",
                    difficulty: "intermediate",
                },
                {
                    questionText: "What is SQL used for?",
                    options: [
                        "Styling web pages",
                        "Managing relational databases",
                        "Building mobile apps",
                        "Writing scripts",
                    ],
                    correctAnswer: "Managing relational databases",
                    topic: "databases",
                    difficulty: "intermediate",
                },
                {
                    questionText: "What is polymorphism?",
                    options: [
                        "Multiple forms of a function or object",
                        "A loop type",
                        "A database join",
                        "A network protocol",
                    ],
                    correctAnswer: "Multiple forms of a function or object",
                    topic: "OOP",
                    difficulty: "intermediate",
                },
                {
                    questionText: "What is Big O notation?",
                    options: [
                        "A math formula",
                        "A way to describe algorithm performance",
                        "A database query",
                        "A design pattern",
                    ],
                    correctAnswer: "A way to describe algorithm performance",
                    topic: "algorithms",
                    difficulty: "intermediate",
                },
                {
                    questionText: "What is a binary tree?",
                    options: [
                        "A tree with two roots",
                        "A hierarchical structure where each node has at most 2 children",
                        "A sorting algorithm",
                        "A type of loop",
                    ],
                    correctAnswer: "A hierarchical structure where each node has at most 2 children",
                    topic: "algorithms",
                    difficulty: "intermediate",
                },
                {
                    questionText: "What is normalization in databases?",
                    options: [
                        "Encrypting data",
                        "Organizing data to reduce redundancy",
                        "Backing up data",
                        "Indexing tables",
                    ],
                    correctAnswer: "Organizing data to reduce redundancy",
                    topic: "databases",
                    difficulty: "intermediate",
                },
                {
                    questionText: "What is the CAP theorem?",
                    options: [
                        "Consistency, Availability, Partition tolerance",
                        "Create, Alter, Partition",
                        "Cache, Access, Process",
                        "None",
                    ],
                    correctAnswer: "Consistency, Availability, Partition tolerance",
                    topic: "databases",
                    difficulty: "advanced",
                },
                {
                    questionText: "What is dynamic programming?",
                    options: [
                        "Writing code dynamically",
                        "Solving problems by breaking them into overlapping subproblems",
                        "A web framework",
                        "A type of database",
                    ],
                    correctAnswer: "Solving problems by breaking them into overlapping subproblems",
                    topic: "algorithms",
                    difficulty: "advanced",
                },
                {
                    questionText: "What is microservices architecture?",
                    options: [
                        "A small computer",
                        "An approach where an app is built as small independent services",
                        "A CSS technique",
                        "A database type",
                    ],
                    correctAnswer: "An approach where an app is built as small independent services",
                    topic: "programming",
                    difficulty: "advanced",
                },
                {
                    questionText: "What is a design pattern?",
                    options: [
                        "A UI template",
                        "A reusable solution to a common software problem",
                        "A database schema",
                        "A CSS framework",
                    ],
                    correctAnswer: "A reusable solution to a common software problem",
                    topic: "programming",
                    difficulty: "advanced",
                },
                {
                    questionText: "What is SOLID in software engineering?",
                    options: [
                        "A database type",
                        "5 principles of object-oriented design",
                        "A testing framework",
                        "A network protocol",
                    ],
                    correctAnswer: "5 principles of object-oriented design",
                    topic: "OOP",
                    difficulty: "advanced",
                },
                {
                    questionText: "What is the difference between SQL and NoSQL?",
                    options: [
                        "SQL is faster than NoSQL",
                        "SQL uses structured tables, NoSQL uses flexible documents/key-value",
                        "NoSQL is only for small projects",
                        "They are the same",
                    ],
                    correctAnswer: "SQL uses structured tables, NoSQL uses flexible documents/key-value",
                    topic: "databases",
                    difficulty: "advanced",
                },
            ];
        }
        const levelTest = new this.levelTestModel({
            studentId,
            questions: selectedQuestions,
        });
        await levelTest.save();
        const testObj = levelTest.toObject();
        testObj.questions = testObj.questions.map((q) => {
            const copy = { ...q };
            delete copy.correctAnswer;
            return copy;
        });
        return testObj;
    }
    async submitLevelTest(id, answers) {
        const test = await this.levelTestModel.findById(id).exec();
        if (!test)
            throw new common_1.NotFoundException(`LevelTest ${id} not found`);
        let correct = 0;
        const processedAnswers = answers.map((ans, index) => {
            const isCorrect = test.questions[index]?.correctAnswer === ans.selectedAnswer;
            if (isCorrect)
                correct++;
            return { ...ans, isCorrect };
        });
        const totalScore = Math.round((correct / test.questions.length) * 100);
        const resultLevel = totalScore >= 70
            ? "advanced"
            : totalScore >= 40
                ? "intermediate"
                : "beginner";
        const topicMap = {};
        test.questions.forEach((q, index) => {
            const topic = q.topic || "General";
            if (!topicMap[topic]) {
                topicMap[topic] = { correct: 0, total: 0 };
            }
            topicMap[topic].total++;
            if (processedAnswers[index]?.isCorrect) {
                topicMap[topic].correct++;
            }
        });
        const detectedStrengths = Object.entries(topicMap)
            .filter(([_, stat]) => Math.round((stat.correct / stat.total) * 100) >= 70)
            .map(([topic, stat]) => ({
            topic,
            score: Math.round((stat.correct / stat.total) * 100),
            correct: stat.correct,
            total: stat.total,
        }));
        const detectedWeaknesses = Object.entries(topicMap)
            .filter(([_, stat]) => Math.round((stat.correct / stat.total) * 100) < 50)
            .map(([topic, stat]) => ({
            topic,
            score: Math.round((stat.correct / stat.total) * 100),
            correct: stat.correct,
            total: stat.total,
        }));
        const updated = await this.levelTestModel
            .findByIdAndUpdate(id, {
            answers: processedAnswers,
            totalScore,
            resultLevel,
            detectedStrengths,
            detectedWeaknesses,
            status: "completed",
            completedAt: new Date(),
        }, { new: true })
            .exec();
        if (!updated)
            throw new common_1.NotFoundException(`LevelTest ${id} not found`);
        await this.profileModel
            .findOneAndUpdate({ userId: test.studentId }, {
            $set: {
                level: resultLevel,
                strengths: detectedStrengths.map((s) => s.topic),
                weaknesses: detectedWeaknesses.map((w) => w.topic),
                levelTestCompleted: true,
                progress: totalScore,
                risk_level: totalScore >= 70 ? "LOW" : totalScore >= 40 ? "MEDIUM" : "HIGH",
            },
            $setOnInsert: {
                userId: test.studentId,
                academic_level: "N/A",
                points_gamification: 0,
            },
        }, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
        })
            .exec();
        return updated;
    }
    async findLevelTestByStudent(studentId) {
        const test = await this.levelTestModel
            .findOne({ studentId })
            .sort({ createdAt: -1 })
            .exec();
        if (!test)
            return null;
        const testObj = test.toObject();
        if (testObj.status === "in-progress") {
            testObj.questions = testObj.questions.map((q) => {
                const copy = { ...q };
                delete copy.correctAnswer;
                return copy;
            });
        }
        return testObj;
    }
    async generateInitialRecommendationsFromLevelTest(studentId) {
        const levelTest = await this.levelTestModel
            .findOne({ studentId, status: "completed" })
            .sort({ completedAt: -1, createdAt: -1 })
            .exec();
        if (!levelTest) {
            throw new common_1.NotFoundException(`No completed level test found for student ${studentId}`);
        }
        const profile = await this.profileModel
            .findOne({ userId: studentId })
            .exec();
        const currentLevel = levelTest.resultLevel || "beginner";
        const sortedWeaknesses = levelTest.detectedWeaknesses?.sort((a, b) => a.score - b.score) || [];
        const sortedStrengths = levelTest.detectedStrengths?.sort((a, b) => b.score - a.score) || [];
        await this.recommendationModel
            .deleteMany({
            studentId,
            isViewed: false,
        })
            .exec();
        const recommendations = [];
        const weaknessesAddressed = [];
        const strengthsChallenged = [];
        for (const weakness of sortedWeaknesses.slice(0, 3)) {
            const rec = await this.recommendationModel.create({
                studentId,
                recommendedContent: `${weakness.topic} — ${currentLevel} remediation exercises`,
                reason: `Based on your level test, you scored ${weakness.score}% in ${weakness.topic} (${weakness.correct}/${weakness.total} correct). Let's strengthen this area with targeted exercises.`,
                contentType: "exercise",
                confidenceScore: Math.max(75, 100 - weakness.score),
                priority: "high",
                isViewed: false,
                generatedAt: new Date(),
            });
            recommendations.push(rec);
            weaknessesAddressed.push(weakness.topic);
        }
        const nextLevel = currentLevel === "beginner"
            ? "intermediate"
            : currentLevel === "intermediate"
                ? "advanced"
                : "advanced";
        for (const strength of sortedStrengths.slice(0, 2)) {
            const rec = await this.recommendationModel.create({
                studentId,
                recommendedContent: `${strength.topic} — ${nextLevel} challenge exercises`,
                reason: `Excellent work in ${strength.topic}! You achieved ${strength.score}% on the level test (${strength.correct}/${strength.total} correct). Ready to level up with advanced challenges?`,
                contentType: "course",
                confidenceScore: Math.min(95, strength.score + 10),
                priority: "low",
                isViewed: false,
                generatedAt: new Date(),
            });
            recommendations.push(rec);
            strengthsChallenged.push(strength.topic);
        }
        return {
            recommendations,
            source: "level-test",
            levelTestScore: levelTest.totalScore || 0,
            resultLevel: currentLevel,
            weaknessesAddressed,
            strengthsChallenged,
            totalGenerated: recommendations.length,
        };
    }
};
exports.AdaptiveLearningService = AdaptiveLearningService;
exports.AdaptiveLearningService = AdaptiveLearningService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(student_profile_schema_1.StudentProfile.name)),
    __param(1, (0, mongoose_1.InjectModel)(student_performance_schema_1.StudentPerformance.name)),
    __param(2, (0, mongoose_1.InjectModel)(recommendation_schema_1.Recommendation.name)),
    __param(3, (0, mongoose_1.InjectModel)(level_test_schema_1.LevelTest.name)),
    __param(4, (0, mongoose_1.InjectModel)(question_schema_1.Question.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], AdaptiveLearningService);
//# sourceMappingURL=adaptive-learning.service.js.map