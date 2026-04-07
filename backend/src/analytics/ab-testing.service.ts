import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AbGroup,
  AbTesting,
  AbTestingDocument,
} from './schemas/ab-testing.schema';
import { RiskScore, RiskScoreDocument } from './schemas/riskscore.schema';
import { Activity, ActivityDocument } from '../activity/schemas/activity.schema';
import { PredictiveService } from './predictive.service';
import { InterventionService } from './intervention.service';

export interface AbAssignmentResult {
  userId: string;
  group: AbGroup;
  intervention: string;
  outcome: string;
}

export interface AbInterventionConfig {
  A: string;
  B: string;
}

@Injectable()
export class AbTestingService {
  private readonly defaultInterventions: AbInterventionConfig = {
    A: 'Schedule 1-on-1 session and personalized feedback',
    B: 'Structured weekly participation plan and progress nudges',
  };

  constructor(
    @InjectModel(AbTesting.name)
    private readonly abTestingModel: Model<AbTestingDocument>,
    @InjectModel(RiskScore.name)
    private readonly riskScoreModel: Model<RiskScoreDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    private readonly predictiveService: PredictiveService,
    private readonly interventionService: InterventionService,
  ) {}

  async assignUserToGroup(
    userId: string,
    interventions: Partial<AbInterventionConfig> = {},
  ): Promise<AbAssignmentResult> {
    const existingAssignment = await this.abTestingModel
      .findOne({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .lean<AbTestingDocument>()
      .exec();

    if (existingAssignment) {
      return this.toAssignmentResult(existingAssignment);
    }

    const group = this.randomGroup();
    const chosenInterventions = await this.resolveInterventions(userId, interventions);

    const assignment = await this.abTestingModel.create({
      userId,
      group,
      intervention: chosenInterventions[group],
      outcome: '',
    });

    return this.toAssignmentResult(assignment);
  }

  async trackOutcome(userId: string, outcome: string): Promise<AbAssignmentResult | null> {
    const updated = await this.abTestingModel
      .findOneAndUpdate(
        { userId },
        {
          $set: {
            outcome: outcome?.trim() || '',
          },
        },
        { new: true },
      )
      .lean<AbTestingDocument>()
      .exec();

    return updated ? this.toAssignmentResult(updated) : null;
  }

  async getUserAssignment(userId: string): Promise<AbAssignmentResult | null> {
    const assignment = await this.abTestingModel
      .findOne({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .lean<AbTestingDocument>()
      .exec();

    return assignment ? this.toAssignmentResult(assignment) : null;
  }

  async listAssignments(limit: number = 100): Promise<AbAssignmentResult[]> {
    const rows = await this.abTestingModel
      .find()
      .sort({ createdAt: -1, _id: -1 })
      .limit(Math.max(1, Math.min(500, limit)))
      .lean<AbTestingDocument[]>()
      .exec();

    return rows.map((row) => this.toAssignmentResult(row));
  }

  private randomGroup(): AbGroup {
    return Math.random() < 0.5 ? AbGroup.A : AbGroup.B;
  }

  private async resolveInterventions(
    userId: string,
    interventions: Partial<AbInterventionConfig>,
  ): Promise<AbInterventionConfig> {
    if (interventions.A || interventions.B) {
      return {
        A: interventions.A || this.defaultInterventions.A,
        B: interventions.B || this.defaultInterventions.B,
      };
    }

    const behaviorData = await this.buildBehaviorData(userId);
    const prediction = this.predictiveService.predictDropoutRisk(behaviorData);
    const riskLevel = await this.getRiskLevel(userId, prediction.level);
    const suggestions = this.interventionService.generateInterventionSuggestions(
      behaviorData,
      riskLevel,
      prediction,
    ).suggestions;

    return {
      A: suggestions[0] || this.defaultInterventions.A,
      B: suggestions[1] || suggestions[0] || this.defaultInterventions.B,
    };
  }

  private async buildBehaviorData(userId: string): Promise<{ inactivity_days: number; engagement_level: number; activity_frequency: number }> {
    if (!Types.ObjectId.isValid(userId)) {
      return { inactivity_days: 14, engagement_level: 0.2, activity_frequency: 0 };
    }

    const objectId = new Types.ObjectId(userId);
    const now = new Date();
    const recentWindowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [latestActivity, recentActivityCount] = await Promise.all([
      this.activityModel
        .findOne({ userId: objectId })
        .sort({ timestamp: -1, _id: -1 })
        .lean<ActivityDocument>()
        .exec(),
      this.activityModel
        .countDocuments({
          userId: objectId,
          timestamp: { $gte: recentWindowStart },
        })
        .exec(),
    ]);

    const inactivityDays = latestActivity?.timestamp
      ? Math.max(
          0,
          Math.floor((now.getTime() - new Date(latestActivity.timestamp).getTime()) / (1000 * 60 * 60 * 24)),
        )
      : 14;

    const activityFrequency = Number((recentActivityCount / 7).toFixed(2));
    const engagementLevel = Number(Math.min(1, Math.max(0, recentActivityCount / 14)).toFixed(2));

    return {
      inactivity_days: inactivityDays,
      engagement_level: engagementLevel,
      activity_frequency: activityFrequency,
    };
  }

  private async getRiskLevel(
    userId: string,
    fallback: 'low' | 'medium' | 'high',
  ): Promise<'low' | 'medium' | 'high'> {
    if (!Types.ObjectId.isValid(userId)) {
      return fallback;
    }

    const latestRisk = await this.riskScoreModel
      .findOne({ user: new Types.ObjectId(userId) })
      .sort({ lastUpdated: -1, _id: -1 })
      .lean<RiskScoreDocument>()
      .exec();

    return (latestRisk?.riskLevel as 'low' | 'medium' | 'high') || fallback;
  }

  private toAssignmentResult(row: Pick<AbTesting, 'userId' | 'group' | 'intervention' | 'outcome'>): AbAssignmentResult {
    return {
      userId: row.userId,
      group: row.group,
      intervention: row.intervention,
      outcome: row.outcome,
    };
  }
}
