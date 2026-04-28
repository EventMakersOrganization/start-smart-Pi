import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AbTesting, AbTestingDocument, AbGroup } from './schemas/ab-testing.schema';
import { RiskScore, RiskScoreDocument, RiskLevel } from './schemas/riskscore.schema';
import { Activity, ActivityDocument } from '../activity/schemas/activity.schema';
import {
  StudentPerformance,
  StudentPerformanceDocument,
} from '../adaptive-learning/schemas/student-performance.schema';
import { User, UserDocument, UserRole, UserStatus } from '../users/schemas/user.schema';
import { AbTestingService } from './ab-testing.service';
import { AlertService } from './alert.service';
import { AlertSeverity } from './schemas/alert.schema';
import { EmailService } from '../notification/email.service';

type StudentMetrics = {
  riskScore: number;
  activity7d: number;
  avgScore: number;
};

@Injectable()
export class AbInterventionAutomationService {
  private readonly logger = new Logger(AbInterventionAutomationService.name);
  private readonly strategyA = 'Daily reminder via email + dashboard notification';
  private readonly strategyB = 'Weekly weak-point study plan + dashboard notification';

  constructor(
    @InjectModel(AbTesting.name)
    private readonly abTestingModel: Model<AbTestingDocument>,
    @InjectModel(RiskScore.name)
    private readonly riskScoreModel: Model<RiskScoreDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(StudentPerformance.name)
    private readonly performanceModel: Model<StudentPerformanceDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly abTestingService: AbTestingService,
    private readonly alertService: AlertService,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDailyAutomation(): Promise<void> {
    const enabled =
      String(process.env.AB_INTERVENTION_AUTOMATION_ENABLED || 'true').toLowerCase() !== 'false';
    if (!enabled) {
      return;
    }
    await this.executeAutomationCycle();
  }

  async runNow(): Promise<{ processed: number; highRiskStudents: number; winner: string }> {
    const processed = await this.executeAutomationCycle();
    const summary = await this.getExperimentSummary();
    return {
      processed,
      highRiskStudents: summary.sampleSize,
      winner: summary.winner,
    };
  }

  async getExperimentSummary(): Promise<{
    winner: string;
    sampleSize: number;
    groupA: { count: number; avgRiskDelta: number };
    groupB: { count: number; avgRiskDelta: number };
  }> {
    const rows = await this.abTestingModel
      .find({ 'checkpoints.0': { $exists: true } })
      .lean<AbTestingDocument[]>()
      .exec();

    const byGroup = {
      A: [] as number[],
      B: [] as number[],
    };

    for (const row of rows as any[]) {
      const checkpoints = Array.isArray(row.checkpoints) ? row.checkpoints : [];
      if (!checkpoints.length) {
        continue;
      }
      const latest = checkpoints.sort((a: any, b: any) => Number(b.day || 0) - Number(a.day || 0))[0];
      const riskDelta = Number(latest?.riskDelta || 0);
      if (row.group === AbGroup.A) {
        byGroup.A.push(riskDelta);
      } else if (row.group === AbGroup.B) {
        byGroup.B.push(riskDelta);
      }
    }

    const avgA = byGroup.A.length
      ? Number((byGroup.A.reduce((s, v) => s + v, 0) / byGroup.A.length).toFixed(2))
      : 0;
    const avgB = byGroup.B.length
      ? Number((byGroup.B.reduce((s, v) => s + v, 0) / byGroup.B.length).toFixed(2))
      : 0;

    const winner = avgA === avgB ? 'tie' : avgA < avgB ? 'A' : 'B';

    return {
      winner,
      sampleSize: byGroup.A.length + byGroup.B.length,
      groupA: { count: byGroup.A.length, avgRiskDelta: avgA },
      groupB: { count: byGroup.B.length, avgRiskDelta: avgB },
    };
  }

  private async executeAutomationCycle(): Promise<number> {
    const students = await this.getHighRiskActiveStudents();
    for (const student of students) {
      try {
        await this.processStudent(student);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`A/B intervention automation failed for ${student._id}: ${msg}`);
      }
    }
    this.logger.log(`A/B intervention automation cycle completed. processed=${students.length}`);
    return students.length;
  }

  private async processStudent(student: any): Promise<void> {
    const userId = String(student._id);
    const assignment = await this.abTestingService.assignUserToGroup(userId, {
      A: this.strategyA,
      B: this.strategyB,
    });

    const metrics = await this.computeStudentMetrics(userId);
    await this.ensureBaseline(userId, metrics);

    if (assignment.group === AbGroup.A) {
      await this.runDailyReminderStrategy(student, metrics);
    } else {
      await this.runWeeklyPlanStrategy(student, metrics);
    }

    await this.recordCheckpoints(userId, metrics);
  }

  private async getHighRiskActiveStudents(): Promise<Array<{ _id: Types.ObjectId; email: string }>> {
    const latestByUser = await this.riskScoreModel
      .aggregate<{ userId: string; riskLevel: string }>([
        { $sort: { lastUpdated: -1, _id: -1 } },
        {
          $group: {
            _id: '$user',
            riskLevel: { $first: { $toLower: '$riskLevel' } },
          },
        },
        {
          $project: {
            _id: 0,
            userId: { $toString: '$_id' },
            riskLevel: 1,
          },
        },
      ])
      .exec();

    const highRiskIds = latestByUser
      .filter((row) => row.riskLevel === RiskLevel.HIGH)
      .map((row) => row.userId)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (!highRiskIds.length) {
      return [];
    }

    return this.userModel
      .find({
        _id: { $in: highRiskIds },
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      })
      .select('_id email')
      .lean<Array<{ _id: Types.ObjectId; email: string }>>()
      .exec();
  }

  private async computeStudentMetrics(userId: string): Promise<StudentMetrics> {
    const objId = new Types.ObjectId(userId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [latestRisk, activity7d, performances] = await Promise.all([
      this.riskScoreModel
        .findOne({ user: objId })
        .sort({ lastUpdated: -1, _id: -1 })
        .lean<RiskScoreDocument>()
        .exec(),
      this.activityModel.countDocuments({ userId: objId, timestamp: { $gte: sevenDaysAgo } }).exec(),
      this.performanceModel
        .find({ studentId: userId, attemptDate: { $gte: sevenDaysAgo } })
        .select('score')
        .lean<StudentPerformanceDocument[]>()
        .exec(),
    ]);

    const scores = (performances as any[]).map((p) => Number(p?.score || 0)).filter(Number.isFinite);
    const avgScore = scores.length
      ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
      : 0;

    return {
      riskScore: Number(latestRisk?.score || 0),
      activity7d: Number(activity7d || 0),
      avgScore,
    };
  }

  private async ensureBaseline(userId: string, metrics: StudentMetrics): Promise<void> {
    await this.abTestingModel.updateOne(
      {
        userId,
        baselineCapturedAt: null,
      },
      {
        $set: {
          baselineRiskScore: metrics.riskScore,
          baselineActivity7d: metrics.activity7d,
          baselineAvgScore: metrics.avgScore,
          baselineCapturedAt: new Date(),
        },
      },
    );
  }

  private async runDailyReminderStrategy(student: { _id: Types.ObjectId; email: string }, metrics: StudentMetrics): Promise<void> {
    const assignment = await this.abTestingModel
      .findOne({ userId: String(student._id) })
      .sort({ createdAt: -1, _id: -1 })
      .lean<AbTestingDocument>()
      .exec();
    if (!assignment) {
      return;
    }

    if (this.isSameUtcDay((assignment as any).lastReminderAt, new Date())) {
      return;
    }

    await this.alertService.create({
      student: student._id,
      userId: student._id,
      severity: AlertSeverity.MEDIUM,
      riskLevel: RiskLevel.HIGH,
      resolved: false,
      message:
        `Daily intervention reminder: complete one 20-minute session today. Current risk ${metrics.riskScore}%.`,
      timestamp: new Date(),
    });

    if (student.email) {
      await this.emailService.sendInterventionEmail({
        to: student.email,
        subject: 'Daily learning reminder',
        headline: 'Your daily intervention plan is ready',
        lines: [
          'Complete one focused 20-minute study session today.',
          'Finish one short quiz and target at least 70%.',
          `Current risk score: ${metrics.riskScore}%`,
        ],
      });
    }

    await this.abTestingModel.updateOne(
      { _id: (assignment as any)._id },
      { $set: { lastReminderAt: new Date() } },
    );
  }

  private async runWeeklyPlanStrategy(student: { _id: Types.ObjectId; email: string }, metrics: StudentMetrics): Promise<void> {
    const assignment = await this.abTestingModel
      .findOne({ userId: String(student._id) })
      .sort({ createdAt: -1, _id: -1 })
      .lean<AbTestingDocument>()
      .exec();
    if (!assignment) {
      return;
    }

    const lastPlanAt = (assignment as any).lastPlanAt;
    if (lastPlanAt && Date.now() - new Date(lastPlanAt).getTime() < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    const plan = await this.buildWeeklyPlan(String(student._id));
    const planMessage = `Weekly plan: ${plan.join(' | ')}`;

    await this.alertService.create({
      student: student._id,
      userId: student._id,
      severity: AlertSeverity.MEDIUM,
      riskLevel: RiskLevel.MEDIUM,
      resolved: false,
      message: planMessage,
      timestamp: new Date(),
    });

    if (student.email) {
      await this.emailService.sendInterventionEmail({
        to: student.email,
        subject: 'Your weekly personalized plan',
        headline: 'This week plan is generated from your weak points',
        lines: [...plan, `Current risk score: ${metrics.riskScore}%`],
      });
    }

    await this.abTestingModel.updateOne(
      { _id: (assignment as any)._id },
      { $set: { lastPlanAt: new Date() } },
    );
  }

  private async buildWeeklyPlan(studentId: string): Promise<string[]> {
    const rows = await this.performanceModel
      .find({ studentId })
      .sort({ attemptDate: -1, _id: -1 })
      .limit(60)
      .select('topic score')
      .lean<StudentPerformanceDocument[]>()
      .exec();

    const byTopic = new Map<string, { total: number; count: number }>();
    for (const row of rows as any[]) {
      const topic = String(row?.topic || 'General').trim();
      const current = byTopic.get(topic) || { total: 0, count: 0 };
      current.total += Number(row?.score || 0);
      current.count += 1;
      byTopic.set(topic, current);
    }

    const ranked = Array.from(byTopic.entries()).map(([topic, stats]) => ({
      topic,
      avg: stats.count ? stats.total / stats.count : 0,
    }));

    const weak = ranked
      .filter((entry) => entry.avg < 65)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 2)
      .map((entry) => entry.topic);

    const strong = ranked
      .filter((entry) => entry.avg >= 75)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 2)
      .map((entry) => entry.topic);

    const weakPart = weak.length ? weak.join(', ') : 'foundational concepts';
    const strongPart = strong.length ? strong.join(', ') : 'recent strengths';

    return [
      `Day 1-2: review weak topics (${weakPart}) with easy exercises`,
      `Day 3-4: complete medium quizzes on ${weakPart}`,
      `Day 5: mixed revision using strengths (${strongPart})`,
      'Day 6-7: one checkpoint quiz and reflect on mistakes',
    ];
  }

  private async recordCheckpoints(userId: string, metrics: StudentMetrics): Promise<void> {
    const assignment = await this.abTestingModel
      .findOne({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .lean<AbTestingDocument>()
      .exec();
    if (!assignment || !(assignment as any).baselineCapturedAt) {
      return;
    }

    const baselineAt = new Date((assignment as any).baselineCapturedAt).getTime();
    const elapsedDays = Math.floor((Date.now() - baselineAt) / (24 * 60 * 60 * 1000));
    const checkpoints: Array<{ day: number }> = Array.isArray((assignment as any).checkpoints)
      ? (assignment as any).checkpoints
      : [];
    const daysDone = new Set(checkpoints.map((c: any) => Number(c.day || 0)));

    const targets = [7, 14].filter((day) => elapsedDays >= day && !daysDone.has(day));
    if (!targets.length) {
      return;
    }

    const baselineRisk = Number((assignment as any).baselineRiskScore || 0);
    const baselineActivity = Number((assignment as any).baselineActivity7d || 0);
    const baselineScore = Number((assignment as any).baselineAvgScore || 0);

    const newEntries = targets.map((day) => ({
      day,
      at: new Date(),
      riskScore: metrics.riskScore,
      activity7d: metrics.activity7d,
      avgScore: metrics.avgScore,
      riskDelta: Number((metrics.riskScore - baselineRisk).toFixed(2)),
      activityDelta: Number((metrics.activity7d - baselineActivity).toFixed(2)),
      scoreDelta: Number((metrics.avgScore - baselineScore).toFixed(2)),
    }));

    const latest = newEntries[newEntries.length - 1];
    const outcome =
      latest.riskDelta <= -10 && latest.activityDelta >= 2 && latest.scoreDelta >= 5
        ? 'improved'
        : latest.riskDelta >= 0
          ? 'worse'
          : 'stable';

    await this.abTestingModel.updateOne(
      { _id: (assignment as any)._id },
      {
        $push: { checkpoints: { $each: newEntries } },
        $set: { outcome },
      },
    );
  }

  private isSameUtcDay(a?: Date | string | null, b: Date = new Date()): boolean {
    if (!a) {
      return false;
    }
    const d1 = new Date(a);
    return (
      d1.getUTCFullYear() === b.getUTCFullYear() &&
      d1.getUTCMonth() === b.getUTCMonth() &&
      d1.getUTCDate() === b.getUTCDate()
    );
  }
}

