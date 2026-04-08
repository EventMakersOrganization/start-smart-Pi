import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RiskLevel, RiskScore, RiskScoreDocument } from './schemas/riskscore.schema';
import { RiskAlgorithmService, ActivityData } from './services/risk-algorithm.service';
import { AlertThresholdService } from './services/alert-threshold.service';
import { AlertService } from './alert.service';

@Injectable()
export class RiskScoreService {
  constructor(
    @InjectModel(RiskScore.name)
    private riskScoreModel: Model<RiskScoreDocument>,
    private riskAlgorithmService: RiskAlgorithmService,
    private alertThresholdService: AlertThresholdService,
    private alertService: AlertService,
  ) {}

  async create(createRiskScoreDto: any): Promise<RiskScore> {
    const riskScore = new this.riskScoreModel({
      ...createRiskScoreDto,
      lastUpdated: new Date(),
    });
    return riskScore.save();
  }

  async findAll(): Promise<RiskScore[]> {
    return this.riskScoreModel.find().populate('user', 'first_name last_name email').exec();
  }

  async findOne(id: string): Promise<RiskScore> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid RiskScore ID: ${id}`);
    }
    const riskScore = await this.riskScoreModel
      .findById(id)
      .populate('user', 'first_name last_name email')
      .exec();
    if (!riskScore) {
      throw new NotFoundException(`RiskScore with ID ${id} not found`);
    }
    return riskScore;
  }

  async findByUser(userId: string): Promise<RiskScore[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException(`Invalid User ID: ${userId}`);
    }
    return this.riskScoreModel
      .find({ user: userId })
      .populate('user', 'first_name last_name email')
      .exec();
  }

  async update(id: string, updateRiskScoreDto: any): Promise<RiskScore> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid RiskScore ID: ${id}`);
    }
    const riskScore = await this.riskScoreModel
      .findByIdAndUpdate(
        id,
        { ...updateRiskScoreDto, lastUpdated: new Date() },
        { new: true },
      )
      .populate('user', 'first_name last_name email')
      .exec();
    if (!riskScore) {
      throw new NotFoundException(`RiskScore with ID ${id} not found`);
    }
    return riskScore;
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid RiskScore ID: ${id}`);
    }
    const result = await this.riskScoreModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`RiskScore with ID ${id} not found`);
    }
  }

  async count(): Promise<number> {
    return this.riskScoreModel.countDocuments().exec();
  }

  /**
   * Calculate risk score using the algorithm and save to database
   * This method integrates the risk algorithm with data persistence
   * and automatically creates alerts if thresholds are exceeded
   */
  async calculateAndSaveRiskScore(activityData: ActivityData): Promise<RiskScore> {
    // Use the algorithm service to calculate the risk score
    const result = this.riskAlgorithmService.calculateRiskScore(activityData);

    // Check if user already has a risk score
    const existingScores = await this.riskScoreModel
      .find({ user: new Types.ObjectId(result.userId) })
      .exec();

    let savedScore: RiskScore;

    if (existingScores.length > 0) {
      // Update the most recent risk score
      const latestScore = existingScores[0];
      savedScore = await this.update(latestScore._id.toString(), {
        score: result.score,
        riskLevel: result.level,
      });
    } else {
      // Create new risk score
      savedScore = await this.create({
        user: result.userId,
        score: result.score,
        riskLevel: result.level,
      });
    }

    // Dynamic Sprint 3 alert triggers.
    await this.triggerAlertsForRiskConditions(activityData, result.score, result.level);

    return savedScore;
  }

  private async triggerAlertsForRiskConditions(
    activityData: ActivityData,
    riskScore: number,
    riskLevel: RiskLevel,
  ): Promise<void> {
    const thresholdConfig = await this.alertThresholdService.getThresholds();
    const triggers: Array<{
      shouldTrigger: boolean;
      triggerType: 'high-risk-threshold' | 'suspicious-activity' | 'abnormal-behavior';
      message: string;
    }> = [
      {
        shouldTrigger:
          riskScore >= thresholdConfig.HIGH_RISK_MIN || riskLevel === RiskLevel.HIGH,
        triggerType: 'high-risk-threshold',
        message: `High risk threshold reached. Score=${riskScore}, level=${riskLevel}.`,
      },
      {
        shouldTrigger: activityData.suspiciousActivityFlag > 0,
        triggerType: 'suspicious-activity',
        message:
          `Suspicious activity detected (flag=${activityData.suspiciousActivityFlag}). ` +
          `Score=${riskScore}, level=${riskLevel}.`,
      },
      {
        shouldTrigger:
          activityData.unusualLoginTime >= 2 ||
          activityData.rapidUserActions >= 3 ||
          activityData.failedLoginAttempts >= 5,
        triggerType: 'abnormal-behavior',
        message:
          'Abnormal behavior pattern detected ' +
          `(failedLogins=${activityData.failedLoginAttempts}, ` +
          `unusualLoginTime=${activityData.unusualLoginTime}, ` +
          `rapidActions=${activityData.rapidUserActions}). ` +
          `Score=${riskScore}, level=${riskLevel}.`,
      },
    ];

    for (const trigger of triggers) {
      if (!trigger.shouldTrigger) {
        continue;
      }

      await this.alertService.triggerRiskAlertIfNeeded({
        userId: activityData.userId,
        riskScore,
        riskLevel,
        message: trigger.message,
        timestamp: new Date(),
        resolved: false,
        triggerType: trigger.triggerType,
      });
    }
  }

  /**
   * Calculate risk scores for multiple users and save to database
   */
  async calculateAndSaveBatchRiskScores(activityDataList: ActivityData[]): Promise<RiskScore[]> {
    const results = this.riskAlgorithmService.calculateBatchRiskScores(activityDataList);
    const savedScores: RiskScore[] = [];

    for (const result of results) {
      const activityData: ActivityData = {
        userId: result.userId,
        failedLoginAttempts: 0,
        unusualLoginTime: 0,
        rapidUserActions: 0,
        suspiciousActivityFlag: 0,
      };

      // Find the original activity data from the input list
      const originalData = activityDataList.find((data) => data.userId === result.userId);
      if (originalData) {
        const savedScore = await this.calculateAndSaveRiskScore(originalData);
        savedScores.push(savedScore);
      }
    }

    return savedScores;
  }
}
