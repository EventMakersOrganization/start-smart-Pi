import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Activity, ActivityDocument } from '../../activity/schemas/activity.schema';
import { RiskScore, RiskScoreDocument, RiskLevel } from '../schemas/riskscore.schema';
import { Alert, AlertDocument } from '../schemas/alert.schema';

export interface KpiResult {
  value: number;
  label: string;
  timestamp: Date;
}

export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  lowPercentage: number;
  mediumPercentage: number;
  highPercentage: number;
  total: number;
  timestamp: Date;
}

@Injectable()
export class KpiService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
    @InjectModel(RiskScore.name) private riskScoreModel: Model<RiskScoreDocument>,
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
  ) {}

  /**
   * Calculate total number of users in the system
   */
  async getTotalUsers(): Promise<KpiResult> {
    const total = await this.userModel.countDocuments().exec();
    
    return {
      value: total,
      label: 'Total Users',
      timestamp: new Date(),
    };
  }

  /**
   * Calculate number of active users (activity in last 24 hours)
   */
  async getActiveUsers(): Promise<KpiResult> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get distinct user IDs with activity in last 24 hours
    const activeUserIds = await this.activityModel
      .distinct('userId', {
        timestamp: { $gte: twentyFourHoursAgo },
      })
      .exec();
    
    return {
      value: activeUserIds.length,
      label: 'Active Users (24h)',
      timestamp: new Date(),
    };
  }

  /**
   * Calculate number of high-risk users
   */
  async getHighRiskUsers(): Promise<KpiResult> {
    const highRiskCount = await this.riskScoreModel
      .countDocuments({
        riskLevel: RiskLevel.HIGH,
      })
      .exec();
    
    return {
      value: highRiskCount,
      label: 'High Risk Users',
      timestamp: new Date(),
    };
  }

  /**
   * Calculate total number of alerts
   */
  async getTotalAlerts(): Promise<KpiResult> {
    const total = await this.alertModel.countDocuments().exec();
    
    return {
      value: total,
      label: 'Total Alerts',
      timestamp: new Date(),
    };
  }

  /**
   * Calculate risk distribution across all users with risk scores
   * Returns counts and percentages for low, medium, and high risk levels
   */
  async getRiskDistribution(): Promise<RiskDistribution> {
    // Use MongoDB aggregation to group by risk level
    const distribution = await this.riskScoreModel.aggregate([
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 },
        },
      },
    ]).exec();

    // Initialize counts
    let lowCount = 0;
    let mediumCount = 0;
    let highCount = 0;

    // Map aggregation results to counts
    distribution.forEach((item) => {
      switch (item._id) {
        case RiskLevel.LOW:
          lowCount = item.count;
          break;
        case RiskLevel.MEDIUM:
          mediumCount = item.count;
          break;
        case RiskLevel.HIGH:
          highCount = item.count;
          break;
      }
    });

    const total = lowCount + mediumCount + highCount;

    // Calculate percentages (avoid division by zero)
    const lowPercentage = total > 0 ? Math.round((lowCount / total) * 100) : 0;
    const mediumPercentage = total > 0 ? Math.round((mediumCount / total) * 100) : 0;
    const highPercentage = total > 0 ? Math.round((highCount / total) * 100) : 0;

    return {
      low: lowCount,
      medium: mediumCount,
      high: highCount,
      lowPercentage,
      mediumPercentage,
      highPercentage,
      total,
      timestamp: new Date(),
    };
  }

  /**
   * Get all KPIs at once for dashboard efficiency
   */
  async getAllKpis() {
    const [totalUsers, activeUsers, highRiskUsers, totalAlerts, riskDistribution] = 
      await Promise.all([
        this.getTotalUsers(),
        this.getActiveUsers(),
        this.getHighRiskUsers(),
        this.getTotalAlerts(),
        this.getRiskDistribution(),
      ]);

    return {
      totalUsers,
      activeUsers,
      highRiskUsers,
      totalAlerts,
      riskDistribution,
      timestamp: new Date(),
    };
  }
}
