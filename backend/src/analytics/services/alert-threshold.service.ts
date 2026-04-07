import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Alert, AlertDocument, AlertSeverity } from '../schemas/alert.schema';
import { RiskLevel } from '../schemas/riskscore.schema';
import { AlertConfigService } from '../../alert-config/alert-config.service';

export interface AlertThresholds {
  LOW_RISK_MAX: number;
  MEDIUM_RISK_MAX: number;
  HIGH_RISK_MIN: number;
}

export interface ThresholdCheckResult {
  shouldAlert: boolean;
  severity: AlertSeverity;
  message: string;
}

@Injectable()
export class AlertThresholdService {
  constructor(
    @InjectModel(Alert.name)
    private alertModel: Model<AlertDocument>,
    private alertConfigService: AlertConfigService,
  ) {}

  private async resolveThresholds(): Promise<AlertThresholds> {
    const config = await this.alertConfigService.getConfig();
    return {
      LOW_RISK_MAX: config.lowThreshold,
      MEDIUM_RISK_MAX: config.mediumThreshold,
      HIGH_RISK_MIN: config.highThreshold,
    };
  }

  /**
   * Check if a risk score exceeds thresholds and should trigger an alert
   */
  async checkThreshold(riskScore: number, riskLevel: RiskLevel): Promise<ThresholdCheckResult> {
    const thresholds = await this.resolveThresholds();

    // Only trigger alerts for HIGH risk scores
    if (riskScore >= thresholds.HIGH_RISK_MIN) {
      return {
        shouldAlert: true,
        severity: AlertSeverity.HIGH,
        message: `High risk activity detected. Risk score: ${riskScore}. Immediate attention required.`,
      };
    }

    // Optional: Can add MEDIUM risk alerts if needed in future
    if (riskScore > thresholds.LOW_RISK_MAX && riskScore <= thresholds.MEDIUM_RISK_MAX) {
      return {
        shouldAlert: false, // Not triggering for medium risk in current implementation
        severity: AlertSeverity.MEDIUM,
        message: `Medium risk activity detected. Risk score: ${riskScore}. Monitor closely.`,
      };
    }

    return {
      shouldAlert: false,
      severity: AlertSeverity.LOW,
      message: '',
    };
  }

  /**
   * Create an alert for a user if thresholds are exceeded
   * Checks for duplicate alerts to avoid creating multiple alerts for the same risk score
   */
  async createAlertIfNeeded(
    userId: string,
    riskScore: number,
    riskLevel: RiskLevel,
  ): Promise<Alert | null> {
    const thresholdCheck = await this.checkThreshold(riskScore, riskLevel);

    if (!thresholdCheck.shouldAlert) {
      return null;
    }

    // Check for existing unresolved alerts for this user to avoid duplicates
    const existingAlert = await this.alertModel
      .findOne({
        student: new Types.ObjectId(userId),
        severity: thresholdCheck.severity,
        resolved: false,
      })
      .exec();

    // If an unresolved alert already exists, don't create a duplicate
    if (existingAlert) {
      return null;
    }

    // Create new alert
    const alert = new this.alertModel({
      student: new Types.ObjectId(userId),
      message: thresholdCheck.message,
      severity: thresholdCheck.severity,
      resolved: false,
    });

    return alert.save();
  }

  /**
   * Get current threshold configuration
   */
  async getThresholds(): Promise<AlertThresholds> {
    return this.resolveThresholds();
  }

  /**
   * Check if a risk level qualifies for automatic alert
   */
  shouldTriggerAlert(riskLevel: RiskLevel): boolean {
    return riskLevel === RiskLevel.HIGH;
  }

  /**
   * Resolve all alerts for a user (useful when risk level improves)
   */
  async resolveUserAlerts(userId: string): Promise<number> {
    const result = await this.alertModel
      .updateMany(
        {
          student: new Types.ObjectId(userId),
          resolved: false,
        },
        {
          resolved: true,
        },
      )
      .exec();

    return result.modifiedCount;
  }
}
