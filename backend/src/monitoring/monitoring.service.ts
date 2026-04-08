import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserStatus } from '../users/schemas/user.schema';
import { Alert, AlertDocument } from '../analytics/schemas/alert.schema';
import {
  RiskLevel,
  RiskScore,
  RiskScoreDocument,
} from '../analytics/schemas/riskscore.schema';

export interface SystemMonitoringMetrics {
  totalUsers: number;
  activeUsers: number;
  totalAlerts: number;
  highRiskUsers: number;
  averageRiskScore: number;
}

@Injectable()
export class MonitoringService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Alert.name) private readonly alertModel: Model<AlertDocument>,
    @InjectModel(RiskScore.name)
    private readonly riskScoreModel: Model<RiskScoreDocument>,
  ) {}

  async getSystemMetrics(): Promise<SystemMonitoringMetrics> {
    const [userStats, totalAlerts, riskStats] = await Promise.all([
      this.getUserStats(),
      this.alertModel.estimatedDocumentCount().exec(),
      this.getRiskStats(),
    ]);

    return {
      totalUsers: userStats.totalUsers,
      activeUsers: userStats.activeUsers,
      totalAlerts,
      highRiskUsers: riskStats.highRiskUsers,
      averageRiskScore: riskStats.averageRiskScore,
    };
  }

  private async getUserStats(): Promise<{ totalUsers: number; activeUsers: number }> {
    const result = await this.userModel
      .aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            active: [
              { $match: { status: UserStatus.ACTIVE } },
              { $count: 'count' },
            ],
          },
        },
      ])
      .exec();

    const facet = result[0] || {};

    return {
      totalUsers: facet.total?.[0]?.count || 0,
      activeUsers: facet.active?.[0]?.count || 0,
    };
  }

  private async getRiskStats(): Promise<{ highRiskUsers: number; averageRiskScore: number }> {
    const result = await this.riskScoreModel
      .aggregate([
        {
          $facet: {
            highRisk: [
              { $match: { riskLevel: RiskLevel.HIGH } },
              { $group: { _id: '$user' } },
              { $count: 'count' },
            ],
            average: [{ $group: { _id: null, value: { $avg: '$score' } } }],
          },
        },
      ])
      .exec();

    const facet = result[0] || {};
    const avg = facet.average?.[0]?.value || 0;

    return {
      highRiskUsers: facet.highRisk?.[0]?.count || 0,
      averageRiskScore: Number(avg.toFixed(2)),
    };
  }
}
