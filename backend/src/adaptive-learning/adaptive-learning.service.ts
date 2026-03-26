import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  StudentProfile,
  StudentProfileDocument,
} from "../users/schemas/student-profile.schema";
import {
  StudentPerformance,
  StudentPerformanceDocument,
} from "./schemas/student-performance.schema";
import {
  Recommendation,
  RecommendationDocument,
} from "./schemas/recommendation.schema";
import { LevelTest, LevelTestDocument } from "./schemas/level-test.schema";
import { Question, QuestionDocument } from "./schemas/question.schema";
import { CreateStudentProfileDto } from "./dto/create-student-profile.dto";
import { CreateStudentPerformanceDto } from "./dto/create-student-performance.dto";
import { CreateRecommendationDto } from "./dto/create-recommendation.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";

@Injectable()
export class AdaptiveLearningService {
  constructor(
    @InjectModel(StudentProfile.name)
    private profileModel: Model<StudentProfileDocument>,
    @InjectModel(StudentPerformance.name)
    private performanceModel: Model<StudentPerformanceDocument>,
    @InjectModel(Recommendation.name)
    private recommendationModel: Model<RecommendationDocument>,
    @InjectModel(LevelTest.name)
    private levelTestModel: Model<LevelTestDocument>,
    @InjectModel(Question.name)
    private questionModel: Model<QuestionDocument>,
  ) {}

  // ══════════════════════════════════
  // STUDENT PROFILE CRUD
  // ══════════════════════════════════

  async createProfile(dto: CreateStudentProfileDto): Promise<StudentProfile> {
    const profile = await this.profileModel
      .findOneAndUpdate(
        { userId: dto.userId },
        {
          $setOnInsert: dto,
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    return profile as StudentProfile;
  }

  async findAllProfiles(): Promise<StudentProfile[]> {
    return this.profileModel.find().exec();
  }

  async findProfileByUserId(userId: string): Promise<StudentProfile> {
    const profile = await this.profileModel.findOne({ userId }).exec();
    if (!profile)
      throw new NotFoundException(`Profile not found for user ${userId}`);
    return profile;
  }

  async updateProfile(
    userId: string,
    updateData: Partial<StudentProfile>,
  ): Promise<StudentProfile> {
    const updated = await this.profileModel
      .findOneAndUpdate({ userId }, updateData, { new: true })
      .exec();
    if (!updated)
      throw new NotFoundException(`Profile not found for user ${userId}`);
    return updated;
  }

  async deleteProfile(userId: string): Promise<void> {
    await this.profileModel.findOneAndDelete({ userId }).exec();
  }

  // ══════════════════════════════════
  // STUDENT PERFORMANCE CRUD
  // ══════════════════════════════════

  async createPerformance(
    dto: CreateStudentPerformanceDto,
  ): Promise<StudentPerformance & { adaptation?: any }> {
    // ── Sauvegarde la performance ──
    const performance = new this.performanceModel(dto);
    await performance.save();

    // ── Déclenche l'adaptation automatiquement ──
    try {
      const adaptation = await this.adaptDifficulty(dto.studentId);
      const result = performance.toObject() as any;
      result.adaptation = adaptation;
      return result;
    } catch {
      return performance.toObject() as any;
    }
  }

  async findAllPerformances(): Promise<StudentPerformance[]> {
    return this.performanceModel.find().exec();
  }

  async findPerformanceByStudent(
    studentId: string,
  ): Promise<StudentPerformance[]> {
    return this.performanceModel
      .find({ studentId })
      .sort({ attemptDate: -1 })
      .exec();
  }

  async deletePerformance(id: string): Promise<void> {
    await this.performanceModel.findByIdAndDelete(id).exec();
  }

  async getAverageScore(studentId: string): Promise<number> {
    const result = await this.performanceModel.aggregate([
      { $match: { studentId } },
      { $group: { _id: null, avg: { $avg: "$score" } } },
    ]);
    return result[0]?.avg || 0;
  }

  // ══════════════════════════════════
  // DIFFICULTY ADAPTATION ALGORITHM
  // ══════════════════════════════════

  async adaptDifficulty(studentId: string): Promise<{
    previousLevel: string;
    newLevel: string;
    reason: string;
    averageScore: number;
    performancesAnalyzed: number;
    action: "UP" | "DOWN" | "KEEP";
  }> {
    // ── 1. Récupère le profil actuel ──
    const profile = await this.profileModel
      .findOne({ userId: studentId })
      .exec();

    const currentLevel = profile?.level || "beginner";

    // ── 2. Récupère les 5 dernières performances ──
    const recentPerformances = await this.performanceModel
      .find({ studentId })
      .sort({ attemptDate: -1 })
      .limit(5)
      .exec();

    // Pas assez de données → pas d'adaptation
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

    // ── 3. Calcul du score moyen ──
    const totalScore = recentPerformances.reduce((sum, p) => sum + p.score, 0);
    const averageScore = Math.round(totalScore / recentPerformances.length);

    // ── 4. Logique d'adaptation ──
    let newLevel = currentLevel;
    let action: "UP" | "DOWN" | "KEEP" = "KEEP";
    let reason = "";

    if (averageScore >= 80) {
      // Monte le niveau
      if (currentLevel === "beginner") {
        newLevel = "intermediate";
        action = "UP";
        reason = `Excellent performance! Average score ${averageScore}% >= 80%. Promoted from Beginner to Intermediate.`;
      } else if (currentLevel === "intermediate") {
        newLevel = "advanced";
        action = "UP";
        reason = `Outstanding performance! Average score ${averageScore}% >= 80%. Promoted from Intermediate to Advanced.`;
      } else {
        action = "KEEP";
        reason = `Already at maximum level (Advanced). Keep up the great work with ${averageScore}% average!`;
      }
    } else if (averageScore <= 40) {
      // Descend le niveau
      if (currentLevel === "advanced") {
        newLevel = "intermediate";
        action = "DOWN";
        reason = `Average score ${averageScore}% <= 40%. Level adjusted from Advanced to Intermediate to consolidate foundations.`;
      } else if (currentLevel === "intermediate") {
        newLevel = "beginner";
        action = "DOWN";
        reason = `Average score ${averageScore}% <= 40%. Level adjusted from Intermediate to Beginner to rebuild core concepts.`;
      } else {
        action = "KEEP";
        reason = `Already at minimum level (Beginner). Average score ${averageScore}%. Focus on improving fundamentals.`;
      }
    } else {
      // Maintient le niveau
      action = "KEEP";
      reason = `Average score ${averageScore}% is between 40% and 80%. Current level (${currentLevel}) is appropriate. Keep practicing!`;
    }

    // ── 5. Met à jour le profil si changement ──
    if (newLevel !== currentLevel) {
      const newRiskLevel =
        averageScore >= 70 ? "LOW" : averageScore >= 40 ? "MEDIUM" : "HIGH";

      await this.profileModel
        .findOneAndUpdate(
          { userId: studentId },
          {
            level: newLevel,
            risk_level: newRiskLevel,
            progress: averageScore,
          },
          { new: true },
        )
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

  // ── Adaptation par topic spécifique ──────────
  async adaptDifficultyByTopic(
    studentId: string,
    topic: string,
  ): Promise<{
    topic: string;
    currentLevel: string;
    suggestedDifficulty: string;
    averageScore: number;
    recommendation: string;
  }> {
    // Récupère les performances sur ce topic
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

    const avg = Math.round(
      topicPerformances.reduce((s, p) => s + p.score, 0) /
        topicPerformances.length,
    );

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
    } else if (avg <= 40) {
      suggestedDifficulty =
        currentLevel === "advanced"
          ? "intermediate"
          : currentLevel === "intermediate"
            ? "beginner"
            : "beginner";
      recommendation = `Struggling with ${topic} (${avg}%). Review easier content first.`;
    } else {
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

  // ══════════════════════════════════════
  async getSpacedRepetitionSchedule(studentId: string): Promise<{
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
  }> {
    try {
      // Fetch all performances for the student
      const performances = await this.performanceModel
        .find({ studentId })
        .sort({ attemptDate: -1 })
        .exec();

      if (!performances || performances.length === 0) {
        return {
          schedule: [],
          overdueCount: 0,
          dueTodayCount: 0,
          nextSession: null,
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Group performances by topic, keeping the most recent
      const topicMap = new Map<string, any>();

      performances.forEach((perf: any) => {
        const topic = (perf.topic || "general").trim() || "general";

        if (!topicMap.has(topic)) {
          topicMap.set(topic, perf);
        }
      });

      const schedule = Array.from(topicMap.values()).map((perf: any) => {
        const lastScore = Number(perf.score) || 0;
        const lastAttemptDate = new Date(perf.attemptDate);

        // 🧠 SM-2 Inspired Interval Calculation based on score
        let intervalDays: number;
        if (lastScore >= 90) {
          intervalDays = 7; // Excellent - review in 1 week
        } else if (lastScore >= 75) {
          intervalDays = 4; // Good - review in 4 days
        } else if (lastScore >= 60) {
          intervalDays = 2; // Fair - review in 2 days
        } else if (lastScore >= 40) {
          intervalDays = 1; // Poor - review tomorrow
        } else {
          intervalDays = 0; // Very poor - review today
        }

        // Calculate next review date
        const nextReviewDate = new Date(lastAttemptDate);
        nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
        nextReviewDate.setHours(0, 0, 0, 0);

        // Calculate days until review (negative means overdue)
        const timeDiffMs = nextReviewDate.getTime() - today.getTime();
        const daysUntilReview = Math.ceil(timeDiffMs / (1000 * 60 * 60 * 24));

        // Determine urgency level
        let urgency: "overdue" | "due_today" | "upcoming" | "scheduled";
        if (daysUntilReview < 0) {
          urgency = "overdue";
        } else if (daysUntilReview === 0) {
          urgency = "due_today";
        } else if (daysUntilReview <= 3) {
          urgency = "upcoming";
        } else {
          urgency = "scheduled";
        }

        // Recommend difficulty based on score trend
        let recommendedDifficulty = "intermediate";
        if (lastScore >= 85) {
          recommendedDifficulty = "advanced";
        } else if (lastScore < 50) {
          recommendedDifficulty = "beginner";
        }

        return {
          topic: perf.topic || "general",
          lastScore,
          lastAttemptDate,
          nextReviewDate,
          intervalDays,
          urgency,
          daysUntilReview,
          recommendedDifficulty,
        };
      });

      // Sort by urgency (overdue first, then due_today, then upcoming, then scheduled)
      const urgencyOrder = {
        overdue: 0,
        due_today: 1,
        upcoming: 2,
        scheduled: 3,
      };

      schedule.sort(
        (a, b) =>
          urgencyOrder[a.urgency as keyof typeof urgencyOrder] -
          urgencyOrder[b.urgency as keyof typeof urgencyOrder],
      );

      // Count overdue and due today
      const overdueCount = schedule.filter(
        (s) => s.urgency === "overdue",
      ).length;
      const dueTodayCount = schedule.filter(
        (s) => s.urgency === "due_today",
      ).length;

      // Get the next session (first item that needs attention)
      let nextSession = null;
      if (schedule.length > 0) {
        const nextItem = schedule[0];
        nextSession = {
          topic: nextItem.topic,
          urgency: nextItem.urgency,
          date: nextItem.nextReviewDate,
        };
      }

      return {
        schedule,
        overdueCount,
        dueTodayCount,
        nextSession,
      };
    } catch (error) {
      console.error("Error in getSpacedRepetitionSchedule:", error);
      throw new Error("Failed to generate spaced repetition schedule");
    }
  }
  // PERSONALIZED RECOMMENDATION v1 API
  // ══════════════════════════════════════

  async generateRecommendations(studentId: string): Promise<{
    recommendations: any[];
    profile: any;
    weakTopics: string[];
    strongTopics: string[];
    totalGenerated: number;
  }> {
    // ── 1. Récupère le profil étudiant ──
    const profile = await this.profileModel
      .findOne({ userId: studentId })
      .exec();

    if (!profile) {
      throw new NotFoundException(`Profile not found for student ${studentId}`);
    }

    const currentLevel = profile.level || "beginner";
    const weaknesses = profile.weaknesses || [];
    const strengths = profile.strengths || [];

    // ── 2. Analyse les performances récentes ──
    const recentPerformances = await this.performanceModel
      .find({ studentId })
      .sort({ attemptDate: -1 })
      .limit(10)
      .exec();

    // Calcul score moyen par topic
    const topicScores: Record<
      string,
      {
        total: number;
        count: number;
      }
    > = {};

    recentPerformances.forEach((p: any) => {
      const topic = p.topic || "general";
      if (!topicScores[topic]) {
        topicScores[topic] = { total: 0, count: 0 };
      }
      topicScores[topic].total += p.score;
      topicScores[topic].count++;
    });

    // Topics faibles depuis performances (score < 60%)
    const weakTopicsFromPerf = Object.entries(topicScores)
      .filter(([_, s]) => Math.round(s.total / s.count) < 60)
      .map(([topic]) => topic);

    // Topics améliorés récemment (score >= 60%)
    // → ont priorité sur le level test
    const improvedTopics = Object.entries(topicScores)
      .filter(([_, s]) => Math.round(s.total / s.count) >= 60)
      .map(([topic]) => topic);

    // Weak = dans profil weaknesses ET pas amélioré récemment
    const allWeakTopics = [
      ...new Set([
        ...weaknesses.filter((w: string) => !improvedTopics.includes(w)),
        ...weakTopicsFromPerf,
      ]),
    ];

    // Topics forts depuis performances (score >= 75%)
    const strongTopicsFromPerf = Object.entries(topicScores)
      .filter(([_, s]) => Math.round(s.total / s.count) >= 75)
      .map(([topic]) => topic);

    // Strong = dans profil strengths OU performances récentes
    // MAIS jamais dans weak (performances récentes ont priorité)
    const allStrongTopics = [
      ...new Set([...strengths, ...strongTopicsFromPerf]),
    ].filter((t) => !allWeakTopics.includes(t));

    // ── 3. Supprime les anciennes recommandations ──
    await this.recommendationModel
      .deleteMany({
        studentId,
        isViewed: false,
      })
      .exec();

    // ── 4. Génère les recommandations ──
    const recommendations: any[] = [];

    // 🔴 Priorité 1 : Topics faibles → exercices du niveau actuel
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

    // 🟡 Priorité 2 : Niveau actuel général
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

    // 🟢 Priorité 3 : Topics forts → exercices niveau supérieur
    const nextLevel =
      currentLevel === "beginner"
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

    // 🔵 Priorité 4 : Si pas de données → recommandation par défaut
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

  // ══════════════════════════════════════
  // PERSONALIZED RECOMMENDATION v2 API
  // ══════════════════════════════════════

  async generateRecommendationsV2(studentId: string): Promise<{
    recommendations: any[];
    profile: any;
    insights: {
      topicsAnalyzed: number;
      levelTestTopicsDetailed: any[];
      topicDiagnostics: any[];
    };
    totalGenerated: number;
  }> {
    const profile = await this.profileModel
      .findOne({ userId: studentId })
      .exec();

    if (!profile) {
      throw new NotFoundException(`Profile not found for student ${studentId}`);
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

    const perfByTopic: Record<
      string,
      {
        count: number;
        scores: number[];
        average: number;
        trend: "up" | "down" | "stable";
      }
    > = {};

    [...recentPerformances].reverse().forEach((p: any) => {
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
      const avg = Math.round(
        stats.scores.reduce((sum, s) => sum + s, 0) / stats.scores.length,
      );
      stats.average = avg;
      stats.trend = this.computeTrend(stats.scores);
    });

    const levelTestTopicsDetailed: any[] = [];
    const levelTestByTopic: Record<
      string,
      {
        score: number;
        correct: number;
        total: number;
        source: "strength" | "weakness";
      }
    > = {};

    if (latestLevelTest) {
      const strengthsDetailed =
        (latestLevelTest as any).detectedStrengths || [];
      const weaknessesDetailed =
        (latestLevelTest as any).detectedWeaknesses || [];

      strengthsDetailed.forEach((s: any) => {
        const row = {
          topic: s.topic,
          score: s.score,
          correct: s.correct,
          total: s.total,
          source: "strength" as const,
        };
        levelTestTopicsDetailed.push(row);
        levelTestByTopic[s.topic] = row;
      });

      weaknessesDetailed.forEach((w: any) => {
        const row = {
          topic: w.topic,
          score: w.score,
          correct: w.correct,
          total: w.total,
          source: "weakness" as const,
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

      if (trend === "down") urgencyScore += 18;
      if (trend === "stable") urgencyScore += 6;
      if (trend === "up") urgencyScore -= 8;

      urgencyScore += Math.min(20, frequency * 4);

      if (test?.source === "weakness") urgencyScore += 15;
      if (test?.source === "strength") urgencyScore -= 12;
      if (test && test.score < 50) urgencyScore += 12;

      if (weaknesses.includes(topic)) urgencyScore += 10;
      if (strengths.includes(topic)) urgencyScore -= 8;

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

    const recommendations: any[] = [];
    const nextLevel =
      currentLevel === "beginner"
        ? "intermediate"
        : currentLevel === "intermediate"
          ? "advanced"
          : "advanced";

    for (const diag of topicDiagnostics.slice(0, 3)) {
      if (diag.urgencyScore < 35) continue;

      const recommendedLevel =
        diag.priority === "high"
          ? currentLevel
          : diag.priority === "medium"
            ? currentLevel
            : nextLevel;

      const payload: any = {
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
      const fallbackPayload: any = {
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

  async getCollaborativeRecommendations(studentId: string): Promise<{
    recommendations: Array<{
      topic: string;
      reason: string;
      similarStudentsCount: number;
      averageSuccessRate: number;
      suggestedDifficulty: string;
    }>;
    similarStudentsFound: number;
    basedOn: string;
  }> {
    const targetProfile = await this.profileModel
      .findOne({ userId: studentId })
      .exec();

    if (!targetProfile) {
      throw new NotFoundException(`Profile not found for student ${studentId}`);
    }

    const [allProfiles, allPerformances] = await Promise.all([
      this.profileModel.find().exec(),
      this.performanceModel.find().exec(),
    ]);

    const performancesByStudent = new Map<string, StudentPerformance[]>();

    allPerformances.forEach((p) => {
      const sid = String((p as any).studentId || "");
      if (!sid) return;
      if (!performancesByStudent.has(sid)) {
        performancesByStudent.set(sid, []);
      }
      performancesByStudent.get(sid)!.push(p as any);
    });

    const targetPerformances = performancesByStudent.get(studentId) || [];
    const targetTopics = new Set(
      targetPerformances
        .map((p: any) => String(p.topic || "general").trim())
        .filter(Boolean),
    );

    const targetAverageScore =
      targetPerformances.length > 0
        ? targetPerformances.reduce((sum: number, p: any) => sum + p.score, 0) /
          targetPerformances.length
        : 0;

    const targetWeaknesses = new Set(
      (targetProfile.weaknesses || []).map((w: string) =>
        String(w || "")
          .trim()
          .toLowerCase(),
      ),
    );

    const candidateSimilarStudents: Array<{
      studentId: string;
      similarity: number;
      performances: StudentPerformance[];
    }> = [];

    for (const profile of allProfiles) {
      const otherStudentId = String((profile as any).userId || "");
      if (!otherStudentId || otherStudentId === studentId) continue;

      const otherPerformances = performancesByStudent.get(otherStudentId) || [];

      let similarity = 0;

      if ((profile.level || "") === (targetProfile.level || "")) {
        similarity += 3;
      }

      const otherTopics = new Set(
        otherPerformances
          .map((p: any) => String(p.topic || "general").trim())
          .filter(Boolean),
      );

      let commonTopicsCount = 0;
      for (const topic of targetTopics) {
        if (otherTopics.has(topic)) {
          commonTopicsCount++;
        }
      }
      similarity += commonTopicsCount * 2;

      if (targetAverageScore > 0 && otherPerformances.length > 0) {
        const otherAverageScore =
          otherPerformances.reduce((sum: number, p: any) => sum + p.score, 0) /
          otherPerformances.length;

        if (Math.abs(otherAverageScore - targetAverageScore) <= 15) {
          similarity += 2;
        }
      }

      const otherWeaknesses = new Set(
        (profile.weaknesses || []).map((w: string) =>
          String(w || "")
            .trim()
            .toLowerCase(),
        ),
      );

      let commonWeaknessesCount = 0;
      for (const weakness of targetWeaknesses) {
        if (otherWeaknesses.has(weakness)) {
          commonWeaknessesCount++;
        }
      }
      similarity += commonWeaknessesCount;

      if (similarity > 0) {
        candidateSimilarStudents.push({
          studentId: otherStudentId,
          similarity,
          performances: otherPerformances,
        });
      }
    }

    const topSimilarStudents = candidateSimilarStudents
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    const topicSuccessMap = new Map<
      string,
      {
        totalScore: number;
        count: number;
        students: Set<string>;
      }
    >();

    topSimilarStudents.forEach((similarStudent) => {
      similarStudent.performances.forEach((p: any) => {
        const topic = String(p.topic || "general").trim();
        if (!topic) return;
        if (targetTopics.has(topic)) return;
        if (Number(p.score) < 70) return;

        if (!topicSuccessMap.has(topic)) {
          topicSuccessMap.set(topic, {
            totalScore: 0,
            count: 0,
            students: new Set<string>(),
          });
        }

        const item = topicSuccessMap.get(topic)!;
        item.totalScore += Number(p.score) || 0;
        item.count += 1;
        item.students.add(similarStudent.studentId);
      });
    });

    const recommendations = Array.from(topicSuccessMap.entries())
      .map(([topic, data]) => {
        const averageSuccessRate =
          data.count > 0
            ? Math.round((data.totalScore / data.count) * 100) / 100
            : 0;

        const suggestedDifficulty =
          averageSuccessRate >= 85
            ? "advanced"
            : averageSuccessRate >= 75
              ? "intermediate"
              : "beginner";

        return {
          topic,
          reason:
            `Students with a profile similar to yours also succeeded on ${topic}. ` +
            `Their average success rate is ${averageSuccessRate}%.`,
          similarStudentsCount: data.students.size,
          averageSuccessRate,
          suggestedDifficulty,
        };
      })
      .sort((a, b) => {
        if (b.similarStudentsCount !== a.similarStudentsCount) {
          return b.similarStudentsCount - a.similarStudentsCount;
        }
        return b.averageSuccessRate - a.averageSuccessRate;
      })
      .slice(0, 5);

    return {
      recommendations,
      similarStudentsFound: topSimilarStudents.length,
      basedOn:
        topSimilarStudents.length > 0
          ? `Top ${topSimilarStudents.length} most similar students (level, common topics, average score proximity, shared weaknesses).`
          : "No sufficiently similar students found from current profiles and performances.",
    };
  }

  // ══════════════════════════════════════
  // STUDY GROUP SUGGESTIONS
  // ══════════════════════════════════════

  async getStudyGroupSuggestions(studentId: string): Promise<{
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
    bestMatch: { userId: string; compatibilityScore: number } | null;
  }> {
    const targetProfile = await this.profileModel
      .findOne({ userId: studentId })
      .exec();

    if (!targetProfile) {
      throw new NotFoundException(`Profile not found for student ${studentId}`);
    }

    const [allProfiles, allPerformances] = await Promise.all([
      this.profileModel.find().exec(),
      this.performanceModel.find().exec(),
    ]);

    // ── Map performances by student ──
    const performancesByStudent = new Map<string, StudentPerformance[]>();
    allPerformances.forEach((p) => {
      const sid = String((p as any).studentId || "");
      if (!sid) return;
      if (!performancesByStudent.has(sid)) {
        performancesByStudent.set(sid, []);
      }
      performancesByStudent.get(sid)!.push(p as any);
    });

    // ── Get target student metrics ──
    const targetPerformances = performancesByStudent.get(studentId) || [];
    const targetTopics = new Set(
      targetPerformances
        .map((p: any) =>
          String(p.topic || "general")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );

    const targetAverageScore =
      targetPerformances.length > 0
        ? targetPerformances.reduce((sum: number, p: any) => sum + p.score, 0) /
          targetPerformances.length
        : 0;

    const targetWeaknesses = new Set(
      (targetProfile.weaknesses || []).map((w: string) =>
        String(w || "")
          .trim()
          .toLowerCase(),
      ),
    );

    const targetStrengths = new Set(
      (targetProfile.strengths || []).map((s: string) =>
        String(s || "")
          .trim()
          .toLowerCase(),
      ),
    );

    // ── Calculate compatibility for each student ──
    interface CandidateStudent {
      studentId: string;
      profile: StudentProfile;
      performances: StudentPerformance[];
      compatibilityScore: number;
      commonWeaknesses: string[];
      complementaryStrengths: string[];
      progressionSimilarity: boolean;
      weakTopics: Set<string>;
      strongTopics: Set<string>;
      averageScore: number;
    }

    const candidates: CandidateStudent[] = [];

    for (const profile of allProfiles) {
      const otherStudentId = String((profile as any).userId || "");
      if (!otherStudentId || otherStudentId === studentId) continue;

      const otherPerformances = performancesByStudent.get(otherStudentId) || [];
      let compatibilityScore = 0;

      // Criterion 1: Same level → +4
      if ((profile.level || "") === (targetProfile.level || "")) {
        compatibilityScore += 4;
      }

      // Get weak topics for the other student
      const otherWeaknesses = new Set(
        (profile.weaknesses || []).map((w: string) =>
          String(w || "")
            .trim()
            .toLowerCase(),
        ),
      );

      const otherStrengths = new Set(
        (profile.strengths || []).map((s: string) =>
          String(s || "")
            .trim()
            .toLowerCase(),
        ),
      );

      // Criterion 2: Common weak topics → +3 per topic
      let commonWeaknesses: string[] = [];
      for (const weakness of targetWeaknesses) {
        if (otherWeaknesses.has(weakness)) {
          commonWeaknesses.push(weakness);
          compatibilityScore += 3;
        }
      }

      // Criterion 3: Complementary strong topics → +2 per topic
      // (one student strong where other is weak)
      let complementaryStrengths: string[] = [];
      for (const strength of targetStrengths) {
        if (otherWeaknesses.has(strength)) {
          complementaryStrengths.push(strength);
          compatibilityScore += 2;
        }
      }

      // Also check reverse
      for (const strength of otherStrengths) {
        if (
          targetWeaknesses.has(strength) &&
          !complementaryStrengths.includes(strength)
        ) {
          complementaryStrengths.push(strength);
          compatibilityScore += 2;
        }
      }

      // Criterion 4: Similar progression (±20%) → +2
      const otherAverageScore =
        otherPerformances.length > 0
          ? otherPerformances.reduce(
              (sum: number, p: any) => sum + p.score,
              0,
            ) / otherPerformances.length
          : 0;

      const progressionDiff = Math.abs(targetAverageScore - otherAverageScore);
      const targetRange = Math.max(1, targetAverageScore * 0.2);

      if (progressionDiff <= targetRange) {
        compatibilityScore += 2;
      }

      // Criterion 5: Same risk level → +1
      if ((targetProfile.risk_level || "") === (profile.risk_level || "")) {
        compatibilityScore += 1;
      }

      // Get weak and strong topics from performances
      const perfByTopic: Record<string, { sum: number; count: number }> = {};
      otherPerformances.forEach((p: any) => {
        const topic = String(p.topic || "general")
          .trim()
          .toLowerCase();
        if (!perfByTopic[topic]) {
          perfByTopic[topic] = { sum: 0, count: 0 };
        }
        perfByTopic[topic].sum += p.score;
        perfByTopic[topic].count++;
      });

      const weakTopics = new Set<string>();
      const strongTopics = new Set<string>();

      Object.entries(perfByTopic).forEach(([topic, stat]) => {
        const avg = stat.sum / stat.count;
        if (avg < 60) weakTopics.add(topic);
        if (avg >= 75) strongTopics.add(topic);
      });

      candidates.push({
        studentId: otherStudentId,
        profile,
        performances: otherPerformances,
        compatibilityScore,
        commonWeaknesses,
        complementaryStrengths,
        progressionSimilarity: progressionDiff <= targetRange,
        weakTopics,
        strongTopics,
        averageScore: otherAverageScore,
      });
    }

    // ── Sort by compatibility score (descending) ──
    candidates.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    const bestMatch =
      candidates.length > 0
        ? {
            userId: candidates[0].studentId,
            compatibilityScore: candidates[0].compatibilityScore,
          }
        : null;

    // ── Create study groups ──
    const suggestedGroups = [];

    // Group 1: Remediation Group
    // Students with same weaknesses working together
    const remediationCandidates = candidates.filter(
      (c) => c.commonWeaknesses.length > 0,
    );

    if (remediationCandidates.length > 0) {
      const remediationMembers = remediationCandidates.slice(0, 3).map((c) => ({
        userId: c.studentId,
        level: c.profile.level || "beginner",
        commonWeaknesses: c.commonWeaknesses,
      }));

      const commonWeakTopics = Array.from(
        new Set(remediationMembers.flatMap((m) => m.commonWeaknesses)),
      );

      suggestedGroups.push({
        groupName: "Remediation Group",
        groupType: "remediation" as const,
        commonTopics: commonWeakTopics,
        suggestedActivities: [
          `Practice exercises on ${commonWeakTopics.join(", ")}`,
          "Share solutions and discuss difficult concepts",
          "Create study notes together",
          "Quiz each other on weak topics",
        ],
        compatibilityScore:
          Math.round(
            (remediationMembers.reduce((sum, m, _, arr) => {
              const candidate = remediationCandidates.find(
                (c) => c.studentId === m.userId,
              );
              return sum + (candidate?.compatibilityScore || 0);
            }, 0) /
              remediationMembers.length) *
              100,
          ) / 100,
        members: remediationMembers,
      });
    }

    // Group 2: Mixed Group
    // Different levels - strong students help weaker ones
    const mixedCandidates = candidates.filter(
      (c) =>
        c.complementaryStrengths.length > 0 &&
        c.profile.level !== targetProfile.level,
    );

    if (mixedCandidates.length > 0) {
      const sortedByLevel = [...mixedCandidates].sort((a, b) => {
        const levelOrder: Record<string, number> = {
          beginner: 0,
          intermediate: 1,
          advanced: 2,
        };
        return (
          (levelOrder[b.profile.level || "beginner"] || 0) -
          (levelOrder[a.profile.level || "beginner"] || 0)
        );
      });

      const mixedMembers = sortedByLevel.slice(0, 3).map((c) => ({
        userId: c.studentId,
        level: c.profile.level || "beginner",
        commonWeaknesses: c.complementaryStrengths,
      }));

      const mixedTopics = Array.from(
        new Set(mixedMembers.flatMap((m) => m.commonWeaknesses)),
      );

      suggestedGroups.push({
        groupName: "Mixed Group",
        groupType: "mixed" as const,
        commonTopics: mixedTopics,
        suggestedActivities: [
          "Peer teaching sessions",
          "Advanced students mentor beginners on weak topics",
          "Progressive exercise difficulty",
          "Collaborative problem solving",
        ],
        compatibilityScore:
          Math.round(
            (mixedMembers.reduce((sum, m, _, arr) => {
              const candidate = mixedCandidates.find(
                (c) => c.studentId === m.userId,
              );
              return sum + (candidate?.compatibilityScore || 0);
            }, 0) /
              mixedMembers.length) *
              100,
          ) / 100,
        members: mixedMembers,
      });
    }

    // Group 3: Advanced Group
    // Advanced/Intermediate students tackling challenges together
    const advancedCandidates = candidates.filter(
      (c) =>
        (c.profile.level === "advanced" ||
          c.profile.level === "intermediate") &&
        (targetProfile.level === "advanced" ||
          targetProfile.level === "intermediate"),
    );

    if (advancedCandidates.length > 0) {
      const advancedMembers = advancedCandidates.slice(0, 3).map((c) => ({
        userId: c.studentId,
        level: c.profile.level || "intermediate",
        commonWeaknesses: c.complementaryStrengths,
      }));

      const advancedTopics = Array.from(
        new Set(advancedMembers.flatMap((m) => m.commonWeaknesses)),
      );

      suggestedGroups.push({
        groupName: "Advanced Group",
        groupType: "advanced" as const,
        commonTopics: advancedTopics,
        suggestedActivities: [
          "Advanced problem-solving challenges",
          "Research and project collaboration",
          "Advanced topic exploration",
          "Competition and benchmarking",
        ],
        compatibilityScore:
          Math.round(
            (advancedMembers.reduce((sum, m, _, arr) => {
              const candidate = advancedCandidates.find(
                (c) => c.studentId === m.userId,
              );
              return sum + (candidate?.compatibilityScore || 0);
            }, 0) /
              advancedMembers.length) *
              100,
          ) / 100,
        members: advancedMembers,
      });
    }

    return {
      suggestedGroups,
      totalStudentsAnalyzed: candidates.length,
      bestMatch,
    };
  }

  // ══════════════════════════════════════
  // LEARNING STYLE DETECTION
  // ══════════════════════════════════════

  async detectLearningStyle(studentId: string): Promise<{
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
  }> {
    // ── Get all performances for student ──
    const performances = await this.performanceModel
      .find({ studentId })
      .sort({ attemptDate: -1 })
      .exec();

    if (!performances || performances.length < 5) {
      throw new NotFoundException(
        `Insufficient performance data for student ${studentId}. Need at least 5 exercises.`,
      );
    }

    // ── Analyze performances ──
    const perfData = performances.map((p: any) => ({
      topic: String(p.topic || "general")
        .trim()
        .toLowerCase(),
      difficulty: String(p.difficulty || "beginner")
        .trim()
        .toLowerCase(),
      timeSpent: Number(p.timeSpent) || 0,
      score: Number(p.score) || 0,
      source: String(p.source || "").trim(),
      attemptDate: p.attemptDate ? new Date(p.attemptDate) : new Date(),
    }));

    // ── Calculate basic metrics ──
    const totalTime = perfData.reduce((sum, p) => sum + p.timeSpent, 0);
    const averageTimePerExercise =
      Math.round((totalTime / perfData.length) * 100) / 100;

    const scores = perfData.map((p) => p.score);
    const averageScore =
      Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) /
      100;

    // ── Calculate score consistency (std deviation) ──
    const variance =
      scores.reduce(
        (sum, score) => sum + Math.pow(score - averageScore, 2),
        0,
      ) / scores.length;
    const scoreConsistency =
      Math.round((100 - Math.sqrt(variance)) * 100) / 100;

    // ── Preferred difficulty analysis ──
    const difficultyStats: Record<string, number> = {};
    perfData.forEach((p) => {
      if (!difficultyStats[p.difficulty]) {
        difficultyStats[p.difficulty] = 0;
      }
      difficultyStats[p.difficulty]++;
    });

    const preferredDifficulty =
      Object.entries(difficultyStats).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "beginner";

    // ── Topic analysis ──
    const topicStats: Record<
      string,
      { count: number; totalScore: number; avgScore: number }
    > = {};

    perfData.forEach((p) => {
      if (!topicStats[p.topic]) {
        topicStats[p.topic] = { count: 0, totalScore: 0, avgScore: 0 };
      }
      topicStats[p.topic].count++;
      topicStats[p.topic].totalScore += p.score;
    });

    Object.keys(topicStats).forEach((topic) => {
      topicStats[topic].avgScore =
        Math.round(
          (topicStats[topic].totalScore / topicStats[topic].count) * 100,
        ) / 100;
    });

    const topicsByScore = Object.entries(topicStats)
      .sort((a, b) => b[1].avgScore - a[1].avgScore)
      .slice(0, 3)
      .map(([topic]) => topic);

    // ── Session regularity (attempt dates) ──
    const uniqueDates = new Set(
      perfData.map((p) => p.attemptDate.toISOString().split("T")[0]),
    );

    const firstAttempt = perfData[perfData.length - 1].attemptDate;
    const lastAttempt = perfData[0].attemptDate;
    const daysBetween = Math.ceil(
      (lastAttempt.getTime() - firstAttempt.getTime()) / (1000 * 60 * 60 * 24),
    );

    const sessionsPerWeek =
      daysBetween > 0
        ? Math.round((uniqueDates.size / daysBetween) * 7 * 100) / 100
        : uniqueDates.size;

    // ── Learning Style Detection ──
    interface StyleScore {
      name: string;
      score: number;
      reason: string;
    }

    const styleScores: StyleScore[] = [];

    // 1. Visual Learner: Good scores on visual topics
    const visualTopics = ["algorithms", "databases", "data-structures"];
    const visualTopicPerformances = perfData.filter((p) =>
      visualTopics.some((vt) => p.topic.includes(vt)),
    );

    if (visualTopicPerformances.length > 0) {
      const visualAvgScore =
        visualTopicPerformances.reduce((sum, p) => sum + p.score, 0) /
        visualTopicPerformances.length;

      if (
        visualAvgScore >= 70 &&
        averageTimePerExercise > 600 &&
        visualAvgScore > averageScore
      ) {
        styleScores.push({
          name: "visual_learner",
          score: Math.min(
            100,
            Math.round(
              ((visualAvgScore / 100) * 50 +
                (averageTimePerExercise / 1000) * 50) *
                100,
            ) / 100,
          ),
          reason: `Strong performance (${visualAvgScore}%) on visual topics with substantial time investment`,
        });
      }
    }

    // 2. Fast Learner: High score / low time ratio > 3
    const fastRatio = averageScore / Math.max(1, averageTimePerExercise / 100);
    if (fastRatio > 3 && averageScore >= 75) {
      styleScores.push({
        name: "fast_learner",
        score: Math.min(100, Math.round((fastRatio / 5) * 100) * 100) / 100,
        reason: `Excellent efficiency ratio: ${Math.round(fastRatio * 100) / 100} points per 100ms`,
      });
    }

    // 3. Methodical Learner: Long time, progressive improvement
    const sortedByDate = [...perfData].reverse();
    let progressiveImprovement = 0;
    let improvementCount = 0;

    for (let i = 1; i < sortedByDate.length; i++) {
      if (sortedByDate[i].score > sortedByDate[i - 1].score) {
        progressiveImprovement++;
      }
      improvementCount++;
    }

    const improvementRatio =
      improvementCount > 0 ? progressiveImprovement / improvementCount : 0;

    if (
      averageTimePerExercise > 600 &&
      improvementRatio > 0.5 &&
      scoreConsistency < 70
    ) {
      styleScores.push({
        name: "methodical_learner",
        score: Math.min(
          100,
          Math.round(
            (improvementRatio * 50 + (1 - scoreConsistency / 100) * 50) * 100,
          ) / 100,
        ),
        reason: `Shows consistent improvement over sessions (${Math.round(improvementRatio * 100)}% improvement rate)`,
      });
    }

    // 4. Challenge Seeker: Prefers intermediate/advanced, score >= 70%
    const advancedPerformances = perfData.filter(
      (p) =>
        (p.difficulty === "intermediate" || p.difficulty === "advanced") &&
        p.score >= 70,
    );

    if (
      advancedPerformances.length > perfData.length * 0.3 &&
      advancedPerformances.length > 0
    ) {
      const advancedAvgScore =
        advancedPerformances.reduce((sum, p) => sum + p.score, 0) /
        advancedPerformances.length;

      styleScores.push({
        name: "challenge_seeker",
        score:
          Math.min(
            100,
            Math.round(
              (advancedPerformances.length / perfData.length) * 50 +
                (advancedAvgScore / 100) * 50,
            ) * 100,
          ) / 100,
        reason: `${Math.round((advancedPerformances.length / perfData.length) * 100)}% of exercises at advanced difficulty with ${advancedAvgScore}% avg score`,
      });
    }

    // 5. Consistent Learner: Regular sessions, low variance
    if (scoreConsistency > 80 && sessionsPerWeek >= 2) {
      styleScores.push({
        name: "consistent_learner",
        score:
          Math.min(
            100,
            Math.round(
              (scoreConsistency / 100) * 50 + (sessionsPerWeek / 5) * 50,
            ) * 100,
          ) / 100,
        reason: `High score consistency (${scoreConsistency}) and ${sessionsPerWeek} sessions/week`,
      });
    }

    // 6. Topic Specialist: Very high score on 1-2 topics
    const topicSpecialization = Object.values(topicStats);
    const bestTopicScore = Math.max(
      ...topicSpecialization.map((t) => t.avgScore),
    );
    const worstTopicScore = Math.min(
      ...topicSpecialization.map((t) => t.avgScore),
    );

    if (
      bestTopicScore >= 85 &&
      worstTopicScore <= 60 &&
      bestTopicScore - worstTopicScore > 30
    ) {
      styleScores.push({
        name: "topic_specialist",
        score:
          Math.min(
            100,
            Math.round(((bestTopicScore - worstTopicScore) / 100) * 100) * 100,
          ) / 100,
        reason: `Significant specialization: ${bestTopicScore}% peak vs ${worstTopicScore}% lowest`,
      });
    }

    // ── Select primary and secondary styles ──
    styleScores.sort((a, b) => b.score - a.score);

    const primaryStyle = styleScores[0] || {
      name: "balanced_learner",
      score: 50,
      reason: "No strong learning style detected",
    };

    const secondaryStyle = styleScores[1] || null;

    // ── Create descriptions and tips ──
    const styleDescriptions: Record<string, string> = {
      visual_learner:
        "You learn best through visual representations. You excel with diagrams, flowcharts, and structured examples.",
      fast_learner:
        "You're a quick learner who grasps concepts rapidly. You prefer efficient, straightforward explanations.",
      methodical_learner:
        "You prefer a structured, step-by-step approach. You improve consistently through practice and reflection.",
      challenge_seeker:
        "You thrive on challenges and complex problems. You prefer pushing your limits over repetitive basics.",
      consistent_learner:
        "You learn best through regular practice. You maintain high quality through disciplined, steady effort.",
      topic_specialist:
        "You have deep expertise in specific areas but should broaden your foundation in other topics.",
      balanced_learner:
        "You have a balanced approach to learning with flexibility across different styles.",
    };

    const styleTips: Record<string, string[]> = {
      visual_learner: [
        "Study with diagrams, flowcharts, and mind maps",
        "Use visualization tools when solving problems",
        "Draw connections between concepts visually",
        "Watch instructional videos with visual explanations",
      ],
      fast_learner: [
        "Challenge yourself with progressively harder problems",
        "Study advanced topics beyond the basics",
        "Focus on breadth alongside depth",
        "Teaching others reinforces your knowledge",
      ],
      methodical_learner: [
        "Create detailed study notes and outlines",
        "Practice regularly with increasing complexity",
        "Review and reflect on each session",
        "Track your progress to see improvements",
      ],
      challenge_seeker: [
        "Seek out competitive coding or advanced exercises",
        "Work on real-world projects and case studies",
        "Join study groups with advanced peers",
        "Don't neglect fundamentals in weaker areas",
      ],
      consistent_learner: [
        "Maintain your study schedule",
        "Set achievable daily/weekly goals",
        "Use habit tracking to stay motivated",
        "Gradually increase difficulty to avoid plateauing",
      ],
      topic_specialist: [
        "Dedicate time to weaker topics each session",
        "Balance depth expertise with breadth skills",
        "Apply your expertise to help others learn",
        "Explore how your specialization connects to other areas",
      ],
      balanced_learner: [
        "Experiment with different learning approaches",
        "Combine visual, methodical, and practical elements",
        "Adapt your style based on the topic",
        "Stay flexible and open to new methods",
      ],
    };

    const styleDescription =
      styleDescriptions[primaryStyle.name] ||
      styleDescriptions["balanced_learner"];
    const learningTips =
      styleTips[primaryStyle.name] || styleTips["balanced_learner"];

    return {
      primaryStyle: primaryStyle.name,
      secondaryStyle: secondaryStyle?.name || null,
      confidence: primaryStyle.score,
      styleDescription,
      learningTips,
      indicators: {
        averageTimePerExercise,
        scoreConsistency,
        preferredDifficulty,
        preferredTopics: topicsByScore,
        sessionsPerWeek,
      },
    };
  }

  // ══════════════════════════════════════
  // LEARNING PATH SUGGESTION API
  // ══════════════════════════════════════

  async getLearningPath(studentId: string): Promise<{
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
  }> {
    const profile = await this.profileModel
      .findOne({ userId: studentId })
      .exec();

    if (!profile) {
      throw new NotFoundException(`Profile not found for student ${studentId}`);
    }

    const currentLevel = profile.level || "beginner";
    const targetLevel =
      currentLevel === "beginner"
        ? "intermediate"
        : currentLevel === "intermediate"
          ? "advanced"
          : "advanced";

    const weaknesses: string[] = profile.weaknesses || [];
    const strengths: string[] = profile.strengths || [];

    const recentPerformances = await this.performanceModel
      .find({ studentId })
      .sort({ attemptDate: -1 })
      .limit(20)
      .exec();

    const latestLevelTest = await this.levelTestModel
      .findOne({ studentId, status: "completed" })
      .sort({ completedAt: -1, createdAt: -1 })
      .exec();

    const perfByTopic: Record<
      string,
      { avg: number; latest: number; count: number }
    > = {};

    recentPerformances.forEach((p: any) => {
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

    const levelTestWeak: string[] = (
      (latestLevelTest as any)?.detectedWeaknesses || []
    ).map((w: any) => w.topic);
    const levelTestStrong: string[] = (
      (latestLevelTest as any)?.detectedStrengths || []
    ).map((s: any) => s.topic);

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

      const isWeak =
        weaknesses.includes(topic) ||
        levelTestWeak.includes(topic) ||
        (typeof avg === "number" && avg < 60);

      const isStrong =
        strengths.includes(topic) ||
        levelTestStrong.includes(topic) ||
        (typeof avg === "number" && avg >= 75);

      const priority: "high" | "medium" | "low" = isWeak
        ? "high"
        : isStrong
          ? "low"
          : "medium";

      const status: "pending" | "in-progress" | "completed" =
        typeof latest === "number" && latest >= 70
          ? "completed"
          : typeof latest === "number" && latest >= 50
            ? "in-progress"
            : "pending";

      let action = `Practice ${topic} at ${currentLevel} level.`;
      if (priority === "high") {
        action = `Reinforce ${topic} fundamentals with guided exercises, then solve a short quiz.`;
      } else if (priority === "medium") {
        action = `Consolidate ${topic} with mixed exercises and one mini-project.`;
      } else {
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

    const pendingHighCount = steps.filter(
      (s) => s.priority === "high" && s.status !== "completed",
    ).length;
    const pendingMediumCount = steps.filter(
      (s) => s.priority === "medium" && s.status !== "completed",
    ).length;

    const baseWeeks =
      currentLevel === "beginner" ? 8 : currentLevel === "intermediate" ? 6 : 4;

    const estimatedWeeks = Math.max(
      2,
      baseWeeks + pendingHighCount * 2 + pendingMediumCount,
    );

    return {
      currentLevel,
      targetLevel,
      estimatedWeeks,
      steps,
    };
  }

  async getWeakAreaRecommendations(studentId: string): Promise<{
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
  }> {
    const profile = await this.profileModel
      .findOne({ userId: studentId })
      .exec();

    if (!profile) {
      throw new NotFoundException(`Profile not found for student ${studentId}`);
    }

    const profileWeaknesses: string[] = profile.weaknesses || [];

    const latestLevelTest = await this.levelTestModel
      .findOne({ studentId, status: "completed" })
      .sort({ completedAt: -1, createdAt: -1 })
      .exec();

    const recentPerformances = await this.performanceModel
      .find({ studentId })
      .sort({ attemptDate: -1 })
      .limit(20)
      .exec();

    const topicScoresFromPerf: Record<
      string,
      { total: number; count: number }
    > = {};

    recentPerformances.forEach((p: any) => {
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

    const weakFromLevelTest: Array<{ topic: string; score: number }> = (
      (latestLevelTest as any)?.detectedWeaknesses || []
    ).map((w: any) => ({
      topic: w.topic,
      score: typeof w.score === "number" ? w.score : 50,
    }));

    const mergedWeakAreas = new Map<
      string,
      {
        topic: string;
        currentScore: number;
        source: "level-test" | "performance" | "profile";
      }
    >();

    const upsertWeakArea = (
      topic: string,
      score: number,
      source: "level-test" | "performance" | "profile",
    ) => {
      const normalizedTopic = (topic || "general").trim();
      if (!normalizedTopic) return;

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
      // Fallback score for profile-only weakness when no numeric evidence exists.
      upsertWeakArea(topic, 55, "profile");
    });

    const weakAreas = Array.from(mergedWeakAreas.values())
      .sort((a, b) => a.currentScore - b.currentScore)
      .slice(0, 5)
      .map((item) => {
        const suggestedDifficulty: "easy" | "medium" | "hard" =
          item.currentScore < 30
            ? "easy"
            : item.currentScore <= 60
              ? "medium"
              : "hard";

        const action = `Complete a targeted ${suggestedDifficulty} remediation exercise in ${item.topic}, then retry a short quiz to validate progress.`;

        const encouragement =
          item.currentScore < 30
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

  async getExerciseCompletionTracking(studentId: string): Promise<{
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
  }> {
    const attempts = await this.performanceModel
      .find({ studentId })
      .sort({ attemptDate: -1 })
      .exec();

    const totalAttempts = attempts.length;
    const totalCompleted = attempts.filter((a: any) => a.score >= 70).length;
    const totalTimeSpent = attempts.reduce(
      (sum: number, a: any) => sum + (Number(a.timeSpent) || 0),
      0,
    );
    const averageScore =
      totalAttempts > 0
        ? Math.round(
            (attempts.reduce((sum: number, a: any) => sum + a.score, 0) /
              totalAttempts) *
              100,
          ) / 100
        : 0;

    const completionRate =
      totalAttempts > 0
        ? Math.round((totalCompleted / totalAttempts) * 10000) / 100
        : 0;

    const topicStats: Record<
      string,
      {
        attempts: number;
        completed: number;
        totalScore: number;
        totalTimeSpent: number;
        lastAttemptDate: Date;
      }
    > = {};

    attempts.forEach((a: any) => {
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
      if (a.score >= 70) topicStats[topic].completed++;
      topicStats[topic].totalScore += a.score;
      topicStats[topic].totalTimeSpent += Number(a.timeSpent) || 0;

      if (
        a.attemptDate &&
        (!topicStats[topic].lastAttemptDate ||
          new Date(a.attemptDate) > new Date(topicStats[topic].lastAttemptDate))
      ) {
        topicStats[topic].lastAttemptDate = a.attemptDate;
      }
    });

    const byTopic = Object.entries(topicStats)
      .map(([topic, stat]) => ({
        topic,
        attempts: stat.attempts,
        completed: stat.completed,
        completionRate:
          stat.attempts > 0
            ? Math.round((stat.completed / stat.attempts) * 10000) / 100
            : 0,
        averageScore:
          stat.attempts > 0
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

    attempts.forEach((a: any) => {
      const difficulty = a.difficulty;
      if (
        difficulty !== "beginner" &&
        difficulty !== "intermediate" &&
        difficulty !== "advanced"
      ) {
        return;
      }

      difficultySeed[difficulty].attempts++;
      if (a.score >= 70) difficultySeed[difficulty].completed++;
      difficultySeed[difficulty].totalScore += a.score;
    });

    const byDifficulty = {
      beginner: {
        attempts: difficultySeed.beginner.attempts,
        completed: difficultySeed.beginner.completed,
        completionRate:
          difficultySeed.beginner.attempts > 0
            ? Math.round(
                (difficultySeed.beginner.completed /
                  difficultySeed.beginner.attempts) *
                  10000,
              ) / 100
            : 0,
        averageScore:
          difficultySeed.beginner.attempts > 0
            ? Math.round(
                (difficultySeed.beginner.totalScore /
                  difficultySeed.beginner.attempts) *
                  100,
              ) / 100
            : 0,
      },
      intermediate: {
        attempts: difficultySeed.intermediate.attempts,
        completed: difficultySeed.intermediate.completed,
        completionRate:
          difficultySeed.intermediate.attempts > 0
            ? Math.round(
                (difficultySeed.intermediate.completed /
                  difficultySeed.intermediate.attempts) *
                  10000,
              ) / 100
            : 0,
        averageScore:
          difficultySeed.intermediate.attempts > 0
            ? Math.round(
                (difficultySeed.intermediate.totalScore /
                  difficultySeed.intermediate.attempts) *
                  100,
              ) / 100
            : 0,
      },
      advanced: {
        attempts: difficultySeed.advanced.attempts,
        completed: difficultySeed.advanced.completed,
        completionRate:
          difficultySeed.advanced.attempts > 0
            ? Math.round(
                (difficultySeed.advanced.completed /
                  difficultySeed.advanced.attempts) *
                  10000,
              ) / 100
            : 0,
        averageScore:
          difficultySeed.advanced.attempts > 0
            ? Math.round(
                (difficultySeed.advanced.totalScore /
                  difficultySeed.advanced.attempts) *
                  100,
              ) / 100
            : 0,
      },
    };

    const recentActivity = attempts.slice(0, 5).map((a: any) => ({
      exerciseId: String(a.exerciseId || ""),
      topic: a.topic || "general",
      score: a.score,
      difficulty: a.difficulty || "unknown",
      date: a.attemptDate,
      status: a.score >= 70 ? ("passed" as const) : ("failed" as const),
    }));

    const uniqueDays = new Set<string>();
    attempts.forEach((a: any) => {
      if (!a.attemptDate) return;
      const d = new Date(a.attemptDate);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(d.getDate()).padStart(2, "0")}`;
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
        const diffDays = Math.round(
          (previous - current) / (1000 * 60 * 60 * 24),
        );
        if (diffDays === 1) {
          currentStreak++;
        } else {
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

  async getLearningVelocity(studentId: string): Promise<{
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
  }> {
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
        recommendation:
          "No performance data yet. Complete a few sessions across the week to start tracking your learning velocity.",
      };
    }

    const weeklyScores = new Map<string, number[]>();
    performances.forEach((p: any) => {
      const weekKey = this.getWeekStartKey(new Date(p.attemptDate));
      if (!weeklyScores.has(weekKey)) {
        weeklyScores.set(weekKey, []);
      }
      weeklyScores.get(weekKey)!.push(p.score);
    });

    const weeklyAverages = Array.from(weeklyScores.entries())
      .map(([week, scores]) => ({
        week,
        avg:
          scores.length > 0
            ? scores.reduce((sum, s) => sum + s, 0) / scores.length
            : 0,
      }))
      .sort((a, b) => (a.week < b.week ? -1 : 1));

    const activeWeeks = Math.max(1, weeklyAverages.length);
    const firstWeekScore = weeklyAverages[0]?.avg ?? 0;
    const lastWeekScore = weeklyAverages[weeklyAverages.length - 1]?.avg ?? 0;
    const weeklyProgress =
      Math.round((lastWeekScore - firstWeekScore) * 100) / 100;
    const globalVelocity =
      Math.round((weeklyProgress / activeWeeks) * 100) / 100;

    const learningPace: "fast" | "normal" | "slow" | "declining" =
      globalVelocity < 0
        ? "declining"
        : globalVelocity >= 5
          ? "fast"
          : globalVelocity >= 1
            ? "normal"
            : "slow";

    const scores = performances.map((p: any) => p.score);
    const sessionsPerWeek = performances.length / activeWeeks;
    const frequencyScore = Math.min(100, (sessionsPerWeek / 3) * 100);
    const stdDev = this.calculateStandardDeviation(scores);
    const stabilityScore = Math.max(0, 100 - stdDev * 3.33);
    const consistencyScore =
      Math.round((frequencyScore * 0.5 + stabilityScore * 0.5) * 100) / 100;

    const topicBuckets = new Map<string, any[]>();
    performances.forEach((p: any) => {
      const topic = (p.topic || "general").trim() || "general";
      if (!topicBuckets.has(topic)) {
        topicBuckets.set(topic, []);
      }
      topicBuckets.get(topic)!.push(p);
    });

    const byTopic = Array.from(topicBuckets.entries())
      .filter(([_, rows]) => rows.length >= 2)
      .map(([topic, rows]) => {
        const sorted = [...rows].sort(
          (a, b) =>
            new Date(a.attemptDate).getTime() -
            new Date(b.attemptDate).getTime(),
        );

        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const firstScore = Number(first.score) || 0;
        const lastScore = Number(last.score) || 0;
        const improvement = Math.round((lastScore - firstScore) * 100) / 100;
        const diffMs =
          new Date(last.attemptDate).getTime() -
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

    const recommendation = this.buildVelocityRecommendation(
      learningPace,
      consistencyScore,
      byTopic,
    );

    return {
      globalVelocity,
      learningPace,
      consistencyScore,
      weeklyProgress,
      byTopic,
      recommendation,
    };
  }

  async getAchievementBadges(studentId: string): Promise<{
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
  }> {
    const [performances, profile, completedLevelTest, velocity] =
      await Promise.all([
        this.performanceModel
          .find({ studentId })
          .sort({ attemptDate: 1 })
          .exec(),
        this.profileModel.findOne({ userId: studentId }).exec(),
        this.levelTestModel.findOne({ studentId, status: "completed" }).exec(),
        this.getLearningVelocity(studentId),
      ]);

    const totalExercises = performances.length;
    const scores = performances.map((p: any) => Number(p.score) || 0);
    const avgScore =
      scores.length > 0
        ? Math.round(
            (scores.reduce((sum, score) => sum + score, 0) / scores.length) *
              100,
          ) / 100
        : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const uniqueTopics = new Set(
      performances.map((p: any) => (p.topic || "general").trim() || "general"),
    );

    const streakInfo = this.computeLongestStreak(performances);
    const maxStreak = streakInfo.maxStreak;

    const topicStats = this.computeTopicStats(performances);
    const maxTopicAverage = Object.values(topicStats).reduce((max, item) => {
      return Math.max(max, item.average);
    }, 0);

    const weaknessImprovement = this.computeWeaknessImprovement(topicStats);
    const comeback = this.computeComeback(performances);

    const levelSignals = this.collectLevelSignals(
      performances,
      completedLevelTest,
      profile,
    );

    const levelUpEarned =
      levelSignals.minRank !== null &&
      levelSignals.maxRank !== null &&
      levelSignals.maxRank > levelSignals.minRank;

    const levelUpProgress =
      levelSignals.minRank !== null && levelSignals.maxRank !== null
        ? Math.min(
            100,
            Math.round(
              ((levelSignals.maxRank - levelSignals.minRank) / 1) * 100,
            ),
          )
        : 0;

    const badgeMeta: Array<{
      id: string;
      name: string;
      description: string;
      icon: string;
      category: string;
      earned: boolean;
      earnedAt?: Date;
      progress?: number;
    }> = [
      {
        id: "first_exercise",
        name: "First Exercise",
        description: "Complete at least one exercise.",
        icon: "play_circle",
        category: "performance",
        earned: totalExercises >= 1,
        earnedAt:
          totalExercises >= 1
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
        earnedAt:
          maxScore >= 100
            ? this.findEarnedAtByScoreThreshold(performances, 100)
            : undefined,
        progress: Math.min(100, maxScore),
      },
      {
        id: "high_achiever",
        name: "High Achiever",
        description:
          "Reach an average score of at least 80% over 5+ exercises.",
        icon: "emoji_events",
        category: "performance",
        earned: totalExercises >= 5 && avgScore >= 80,
        earnedAt:
          totalExercises >= 5 && avgScore >= 80
            ? new Date(
                performances[Math.min(4, performances.length - 1)].attemptDate,
              )
            : undefined,
        progress:
          Math.round(
            (Math.min(100, (totalExercises / 5) * 100) * 0.4 +
              Math.min(100, (avgScore / 80) * 100) * 0.6) *
              100,
          ) / 100,
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
        earnedAt:
          velocity.globalVelocity > 5 && performances.length > 0
            ? new Date(performances[performances.length - 1].attemptDate)
            : undefined,
        progress: Math.max(
          0,
          Math.min(100, Math.round((velocity.globalVelocity / 5) * 100)),
        ),
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
        earnedAt:
          maxTopicAverage >= 90
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
        earnedAt:
          uniqueTopics.size >= 4 && performances.length > 0
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
        earnedAt:
          weaknessImprovement.bestImprovement >= 30
            ? weaknessImprovement.earnedAt
            : undefined,
        progress: Math.min(
          100,
          Math.round((weaknessImprovement.bestImprovement / 30) * 100),
        ),
      },
      {
        id: "rookie",
        name: "Rookie",
        description: "Complete your first exercise milestone.",
        icon: "flag",
        category: "milestone",
        earned: totalExercises >= 1,
        earnedAt:
          totalExercises >= 1
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
        earnedAt:
          totalExercises >= 10
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
        earnedAt:
          totalExercises >= 25
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
          ? new Date(
              (completedLevelTest as any).completedAt ||
                (completedLevelTest as any).createdAt,
            )
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
    const completionRate =
      totalBadges > 0
        ? Math.round((earnedBadges / totalBadges) * 10000) / 100
        : 0;

    return {
      totalBadges,
      earnedBadges,
      completionRate,
      badges,
    };
  }

  private computeTrend(scores: number[]): "up" | "down" | "stable" {
    if (scores.length < 2) return "stable";

    const first = scores[0];
    const last = scores[scores.length - 1];
    const delta = last - first;

    if (delta >= 8) return "up";
    if (delta <= -8) return "down";
    return "stable";
  }

  private computePriority(urgencyScore: number): "high" | "medium" | "low" {
    if (urgencyScore >= 70) return "high";
    if (urgencyScore >= 45) return "medium";
    return "low";
  }

  private buildReasonV2(
    topic: string,
    level: string,
    diag: {
      frequency: number;
      trend: "up" | "down" | "stable";
      perfAvg: number | null;
      levelTest: {
        score: number;
        correct: number;
        total: number;
        source: "strength" | "weakness";
      } | null;
      priority: "high" | "medium" | "low";
    },
  ): string {
    const perfPart =
      diag.perfAvg === null
        ? `No recent performance average available for ${topic}.`
        : `Recent average in ${topic} is ${diag.perfAvg}%.`;

    const trendPart =
      diag.trend === "up"
        ? `Trend is improving.`
        : diag.trend === "down"
          ? `Trend is declining.`
          : `Trend is stable.`;

    const frequencyPart = `Topic frequency in recent attempts: ${diag.frequency}.`;

    const levelTestPart = diag.levelTest
      ? `Level test detail: ${diag.levelTest.correct}/${diag.levelTest.total} correct (${diag.levelTest.score}%), tagged as ${diag.levelTest.source}.`
      : `No detailed level test stat found for this topic.`;

    return (
      `${perfPart} ${trendPart} ${frequencyPart} ${levelTestPart} ` +
      `Priority is ${diag.priority}. Recommended action: ${topic} at ${level} focus.`
    );
  }

  // ── Helpers privés ────────────────────────────

  private buildWeakReason(
    topic: string,
    level: string,
    stat?: { total: number; count: number },
  ): string {
    if (stat && stat.count > 0) {
      const avg = Math.round(stat.total / stat.count);
      return (
        `Your average score in ${topic} is ${avg}%. ` +
        `Practice more ${level} exercises to improve this area.`
      );
    }
    return (
      `${topic} was detected as a weak area in your ` +
      `level test. Focus on ${level} exercises to improve.`
    );
  }

  private calcConfidence(
    stat?: { total: number; count: number },
    type?: "weak" | "strong",
  ): number {
    if (!stat || stat.count === 0) return 65;
    const avg = Math.round(stat.total / stat.count);
    if (type === "weak") {
      // Plus le score est bas, plus on est confiant
      // que l'exercice est nécessaire
      return Math.min(95, 100 - avg);
    }
    // Plus le score est haut, plus on est confiant
    // que le challenge est approprié
    return Math.min(95, avg);
  }

  private getWeekStartKey(date: Date): string {
    const utcDate = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const day = utcDate.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    utcDate.setUTCDate(utcDate.getUTCDate() + diffToMonday);
    return utcDate.toISOString().slice(0, 10);
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private buildVelocityRecommendation(
    learningPace: "fast" | "normal" | "slow" | "declining",
    consistencyScore: number,
    byTopic: Array<{ topic: string; velocity: number }> = [],
  ): string {
    const bestTopic = byTopic[0];
    const worstTopic = [...byTopic].sort((a, b) => a.velocity - b.velocity)[0];

    if (learningPace === "declining") {
      return (
        `Your recent trajectory is declining. Reduce difficulty temporarily and ` +
        `focus on fundamentals${worstTopic ? ` in ${worstTopic.topic}` : ""}. ` +
        `Aim for 3+ focused sessions per week to recover momentum.`
      );
    }

    if (learningPace === "fast") {
      return (
        `Excellent momentum. Keep your routine and add challenge exercises` +
        `${bestTopic ? ` in ${bestTopic.topic}` : ""} to sustain growth.`
      );
    }

    if (consistencyScore < 60) {
      return (
        `Progress is present but inconsistent. Spread sessions across the week ` +
        `and keep score variation controlled for steadier improvement.`
      );
    }

    if (learningPace === "normal") {
      return (
        `You are progressing at a healthy pace. Maintain your current rhythm and ` +
        `gradually increase difficulty to keep improving.`
      );
    }

    return (
      `Your progress is currently slow. Increase weekly practice frequency and ` +
      `review weak concepts before moving to harder content.`
    );
  }

  private findEarnedAtByScoreThreshold(
    performances: any[],
    threshold: number,
  ): Date | undefined {
    const item = performances.find((p: any) => Number(p.score) >= threshold);
    return item?.attemptDate ? new Date(item.attemptDate) : undefined;
  }

  private findEarnedAtByUniqueTopics(
    performances: any[],
    targetCount: number,
  ): Date | undefined {
    const topicSet = new Set<string>();
    for (const p of performances) {
      const topic = (p.topic || "general").trim() || "general";
      topicSet.add(topic);
      if (topicSet.size >= targetCount) {
        return p.attemptDate ? new Date(p.attemptDate) : undefined;
      }
    }
    return undefined;
  }

  private computeLongestStreak(performances: any[]): {
    maxStreak: number;
    earnedAt?: Date;
  } {
    if (performances.length === 0) {
      return { maxStreak: 0 };
    }

    const uniqueDays = Array.from(
      new Set(
        performances.map((p: any) => {
          const d = new Date(p.attemptDate);
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
            2,
            "0",
          )}-${String(d.getUTCDate()).padStart(2, "0")}`;
        }),
      ),
    )
      .map((day) => new Date(`${day}T00:00:00.000Z`))
      .sort((a, b) => a.getTime() - b.getTime());

    if (uniqueDays.length === 0) return { maxStreak: 0 };

    let maxStreak = 1;
    let currentStreak = 1;
    let earnedAt: Date | undefined;

    for (let i = 1; i < uniqueDays.length; i++) {
      const prev = uniqueDays[i - 1].getTime();
      const current = uniqueDays[i].getTime();
      const diffDays = Math.round((current - prev) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
      } else {
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

  private computeTopicStats(performances: any[]): Record<
    string,
    {
      firstScore: number;
      lastScore: number;
      average: number;
      scores: number[];
      firstDate?: Date;
      lastDate?: Date;
    }
  > {
    const bucket: Record<string, any[]> = {};
    performances.forEach((p: any) => {
      const topic = (p.topic || "general").trim() || "general";
      if (!bucket[topic]) bucket[topic] = [];
      bucket[topic].push(p);
    });

    const stats: Record<string, any> = {};
    Object.keys(bucket).forEach((topic) => {
      const sorted = [...bucket[topic]].sort(
        (a, b) =>
          new Date(a.attemptDate).getTime() - new Date(b.attemptDate).getTime(),
      );
      const scores = sorted.map((p: any) => Number(p.score) || 0);
      const avg =
        scores.length > 0
          ? scores.reduce((sum: number, s: number) => sum + s, 0) /
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

  private computeWeaknessImprovement(topicStats: Record<string, any>): {
    bestImprovement: number;
    earnedAt?: Date;
  } {
    let bestImprovement = 0;
    let earnedAt: Date | undefined;

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

  private computeComeback(performances: any[]): {
    earned: boolean;
    bestRebound: number;
    earnedAt?: Date;
  } {
    const scores = performances.map((p: any) => Number(p.score) || 0);
    if (scores.length < 3) {
      return { earned: false, bestRebound: 0 };
    }

    let bestRebound = 0;
    let earnedAt: Date | undefined;

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
          .find((p: any) => Number(p.score) === futurePeak);
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

  private collectLevelSignals(
    performances: any[],
    completedLevelTest: any,
    profile: any,
  ): {
    minRank: number | null;
    maxRank: number | null;
    firstUpgradeAt?: Date;
  } {
    const rankMap: Record<string, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
    };

    const signals: Array<{ rank: number; at?: Date }> = [];

    performances.forEach((p: any) => {
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
    let firstUpgradeAt: Date | undefined;

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

  // ══════════════════════════════════
  // RECOMMENDATION CRUD
  // ══════════════════════════════════

  async createRecommendation(
    dto: CreateRecommendationDto,
  ): Promise<Recommendation> {
    const recommendation = new this.recommendationModel(dto);
    return recommendation.save();
  }

  async findRecommendationsByStudent(
    studentId: string,
  ): Promise<Recommendation[]> {
    return this.recommendationModel
      .find({ studentId })
      .sort({ generatedAt: -1 })
      .exec();
  }

  async markRecommendationViewed(id: string): Promise<Recommendation> {
    const rec = await this.recommendationModel
      .findByIdAndUpdate(id, { isViewed: true }, { new: true })
      .exec();
    if (!rec) throw new NotFoundException(`Recommendation ${id} not found`);
    return rec;
  }

  async deleteRecommendation(id: string): Promise<void> {
    await this.recommendationModel.findByIdAndDelete(id).exec();
  }

  // ══════════════════════════════════
  // QUESTION BANK CRUD
  // ══════════════════════════════════

  async createQuestion(dto: CreateQuestionDto): Promise<Question> {
    const question = new this.questionModel(dto);
    return question.save();
  }

  async findAllQuestions(): Promise<Question[]> {
    return this.questionModel.find().exec();
  }

  // ══════════════════════════════════
  // LEVEL TEST CRUD
  // ══════════════════════════════════

  async createLevelTest(studentId: string): Promise<any> {
    // 5 Beginner, 8 Intermediate, 7 Advanced
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

    // Construct the test with the exact 10 dynamically sampled questions
    let selectedQuestions = [...beginnerQs, ...intermediateQs, ...advancedQs];

    // Fallback logic if database is empty
    if (selectedQuestions.length === 0) {
      selectedQuestions = [
        // ── BEGINNER (6) ──────────────────────
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
        // ── INTERMEDIATE (8) ──────────────────
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
          correctAnswer:
            "A hierarchical structure where each node has at most 2 children",
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
        // ── ADVANCED (6) ──────────────────────
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
          correctAnswer:
            "Solving problems by breaking them into overlapping subproblems",
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
          correctAnswer:
            "An approach where an app is built as small independent services",
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
          correctAnswer:
            "SQL uses structured tables, NoSQL uses flexible documents/key-value",
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

    // Return to frontend with stripped 'correctAnswer' to prevent cheating
    const testObj = levelTest.toObject();
    testObj.questions = testObj.questions.map((q: any) => {
      const copy = { ...q };
      delete copy.correctAnswer;
      return copy;
    });

    return testObj;
  }

  async submitLevelTest(id: string, answers: any[]): Promise<LevelTest> {
    const test = await this.levelTestModel.findById(id).exec();
    if (!test) throw new NotFoundException(`LevelTest ${id} not found`);

    let correct = 0;

    // ── Calcul des réponses ──────────────────
    const processedAnswers = answers.map((ans, index) => {
      const isCorrect =
        test.questions[index]?.correctAnswer === ans.selectedAnswer;
      if (isCorrect) correct++;
      return { ...ans, isCorrect };
    });

    // ── Score global ─────────────────────────
    const totalScore = Math.round((correct / test.questions.length) * 100);

    const resultLevel =
      totalScore >= 70
        ? "advanced"
        : totalScore >= 40
          ? "intermediate"
          : "beginner";

    // ── Détection forces/faiblesses par topic ─
    const topicMap: Record<string, { correct: number; total: number }> = {};

    test.questions.forEach((q: any, index: number) => {
      const topic = q.topic || "General";
      if (!topicMap[topic]) {
        topicMap[topic] = { correct: 0, total: 0 };
      }
      topicMap[topic].total++;
      if (processedAnswers[index]?.isCorrect) {
        topicMap[topic].correct++;
      }
    });

    // Force = topic avec score >= 70%
    const detectedStrengths = Object.entries(topicMap)
      .filter(
        ([_, stat]) => Math.round((stat.correct / stat.total) * 100) >= 70,
      )
      .map(([topic, stat]) => ({
        topic,
        score: Math.round((stat.correct / stat.total) * 100),
        correct: stat.correct,
        total: stat.total,
      }));

    // Faiblesse = topic avec score < 50%
    const detectedWeaknesses = Object.entries(topicMap)
      .filter(([_, stat]) => Math.round((stat.correct / stat.total) * 100) < 50)
      .map(([topic, stat]) => ({
        topic,
        score: Math.round((stat.correct / stat.total) * 100),
        correct: stat.correct,
        total: stat.total,
      }));

    // ── Mise à jour MongoDB ───────────────────
    const updated = await this.levelTestModel
      .findByIdAndUpdate(
        id,
        {
          answers: processedAnswers,
          totalScore,
          resultLevel,
          detectedStrengths,
          detectedWeaknesses,
          status: "completed",
          completedAt: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!updated) throw new NotFoundException(`LevelTest ${id} not found`);

    // ── Met à jour (ou crée) le profil étudiant de façon atomique ─────────
    await this.profileModel
      .findOneAndUpdate(
        { userId: test.studentId },
        {
          $set: {
            level: resultLevel,
            strengths: detectedStrengths.map((s: any) => s.topic),
            weaknesses: detectedWeaknesses.map((w: any) => w.topic),
            levelTestCompleted: true,
            progress: totalScore,
            risk_level:
              totalScore >= 70 ? "LOW" : totalScore >= 40 ? "MEDIUM" : "HIGH",
          },
          $setOnInsert: {
            userId: test.studentId,
            academic_level: "N/A",
            points_gamification: 0,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    return updated;
  }

  async findLevelTestByStudent(studentId: string): Promise<any> {
    const test = await this.levelTestModel
      .findOne({ studentId })
      .sort({ createdAt: -1 })
      .exec();

    if (!test) return null;

    // Strip out correctAnswer if the test is still in-progress
    const testObj = test.toObject();
    if (testObj.status === "in-progress") {
      testObj.questions = testObj.questions.map((q: any) => {
        const copy = { ...q };
        delete copy.correctAnswer;
        return copy;
      });
    }

    return testObj;
  }

  // ══════════════════════════════════════════════════════
  // INITIAL RECOMMENDATIONS FROM LEVEL TEST API
  // ══════════════════════════════════════════════════════

  async generateInitialRecommendationsFromLevelTest(
    studentId: string,
  ): Promise<{
    recommendations: any[];
    source: string;
    levelTestScore: number;
    resultLevel: string;
    weaknessesAddressed: string[];
    strengthsChallenged: string[];
    totalGenerated: number;
  }> {
    // ── 1. Récupère le dernier level test complété ──
    const levelTest = await this.levelTestModel
      .findOne({ studentId, status: "completed" })
      .sort({ completedAt: -1, createdAt: -1 })
      .exec();

    if (!levelTest) {
      throw new NotFoundException(
        `No completed level test found for student ${studentId}`,
      );
    }

    // ── 2. Récupère le profil étudiant ──
    const profile = await this.profileModel
      .findOne({ userId: studentId })
      .exec();

    const currentLevel = levelTest.resultLevel || "beginner";

    // ── 3. Trie les weaknesses par score (ASC) ──
    const sortedWeaknesses =
      (levelTest as any).detectedWeaknesses?.sort(
        (a: any, b: any) => a.score - b.score,
      ) || [];

    // ── 4. Trie les strengths par score (DESC) ──
    const sortedStrengths =
      (levelTest as any).detectedStrengths?.sort(
        (a: any, b: any) => b.score - a.score,
      ) || [];

    // ── 5. Supprime les anciennes recommandations non vues ──
    await this.recommendationModel
      .deleteMany({
        studentId,
        isViewed: false,
      })
      .exec();

    // ── 6. Génère max 5 recommandations ──
    const recommendations: any[] = [];
    const weaknessesAddressed: string[] = [];
    const strengthsChallenged: string[] = [];

    // 🔴 Priorité 1 : 3 exercices de remédiation (weaknesses)
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

    // 🟢 Priorité 2 : 2 challenges niveau supérieur (strengths)
    const nextLevel =
      currentLevel === "beginner"
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
      levelTestScore: (levelTest as any).totalScore || 0,
      resultLevel: currentLevel,
      weaknessesAddressed,
      strengthsChallenged,
      totalGenerated: recommendations.length,
    };
  }
}
