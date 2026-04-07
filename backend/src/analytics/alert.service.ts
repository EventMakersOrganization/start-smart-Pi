import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Alert, AlertDocument, AlertSeverity } from './schemas/alert.schema';
import { RiskLevel } from './schemas/riskscore.schema';
import { EmailService } from '../notification/email.service';
import { User, UserDocument } from '../users/schemas/user.schema';

export type AlertTriggerType =
  | 'high-risk-threshold'
  | 'suspicious-activity'
  | 'abnormal-behavior';

export interface AlertTriggerPayload {
  userId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  message: string;
  timestamp?: Date;
  resolved?: boolean;
  triggerType: AlertTriggerType;
}

@Injectable()
export class AlertService {
  constructor(
    @InjectModel(Alert.name)
    private alertModel: Model<AlertDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private emailService: EmailService,
  ) {}

  async create(createAlertDto: any): Promise<Alert> {
    const alert = new this.alertModel(createAlertDto);
    const savedAlert = await alert.save();
    await this.notifyIfHighRisk(savedAlert);
    return savedAlert;
  }

  /**
   * Reusable trigger path for risk-driven alerts.
   * Avoids creating duplicate unresolved alerts for the same user and trigger type.
   */
  async triggerRiskAlertIfNeeded(payload: AlertTriggerPayload): Promise<Alert | null> {
    if (!Types.ObjectId.isValid(payload.userId)) {
      throw new NotFoundException(`Invalid User ID: ${payload.userId}`);
    }

    const userObjectId = new Types.ObjectId(payload.userId);

    const existingAlert = await this.alertModel
      .findOne({
        student: userObjectId,
        triggerType: payload.triggerType,
        resolved: false,
      })
      .exec();

    if (existingAlert) {
      return null;
    }

    const alert = new this.alertModel({
      // Keep existing field for Sprint 1/2 compatibility.
      student: userObjectId,
      // New metadata required by Sprint 3 trigger logic.
      userId: userObjectId,
      riskScore: payload.riskScore,
      riskLevel: payload.riskLevel,
      message: payload.message,
      timestamp: payload.timestamp ?? new Date(),
      resolved: payload.resolved ?? false,
      severity: this.mapRiskLevelToSeverity(payload.riskLevel),
      triggerType: payload.triggerType,
    });

    const savedAlert = await alert.save();
    await this.notifyIfHighRisk(savedAlert);
    return savedAlert;
  }

  private mapRiskLevelToSeverity(riskLevel: RiskLevel): 'low' | 'medium' | 'high' {
    if (riskLevel === RiskLevel.HIGH) {
      return 'high';
    }
    if (riskLevel === RiskLevel.MEDIUM) {
      return 'medium';
    }
    return 'low';
  }

  private async notifyIfHighRisk(alert: AlertDocument): Promise<void> {
    if (alert.severity !== AlertSeverity.HIGH) {
      return;
    }

    const targetUserId = (alert.userId || alert.student) as Types.ObjectId | undefined;
    if (!targetUserId || !Types.ObjectId.isValid(targetUserId.toString())) {
      return;
    }

    const user = await this.userModel.findById(targetUserId).select('email').lean().exec();
    if (!user?.email) {
      return;
    }

    await this.emailService.sendHighRiskAlertEmail({
      to: user.email,
      riskLevel: alert.riskLevel || alert.severity,
      alertMessage: alert.message,
      timestamp: alert.timestamp || new Date(),
    });
  }

  async findAll(): Promise<Alert[]> {
    return this.alertModel
      .find()
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .exec();
  }

  async findOne(id: string): Promise<Alert> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid Alert ID: ${id}`);
    }
    const alert = await this.alertModel
      .findById(id)
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .exec();
    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }
    return alert;
  }

  async findByStudent(studentId: string): Promise<Alert[]> {
    if (!Types.ObjectId.isValid(studentId)) {
      throw new NotFoundException(`Invalid Student ID: ${studentId}`);
    }
    return this.alertModel
      .find({ student: studentId })
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .exec();
  }

  async findByInstructor(instructorId: string): Promise<Alert[]> {
    if (!Types.ObjectId.isValid(instructorId)) {
      throw new NotFoundException(`Invalid Instructor ID: ${instructorId}`);
    }
    return this.alertModel
      .find({ instructor: instructorId })
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .exec();
  }

  async findUnresolved(): Promise<Alert[]> {
    return this.alertModel
      .find({ resolved: false })
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .exec();
  }

  async update(id: string, updateAlertDto: any): Promise<Alert> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid Alert ID: ${id}`);
    }
    const alert = await this.alertModel
      .findByIdAndUpdate(id, updateAlertDto, { new: true })
      .populate('student', 'first_name last_name email')
      .populate('instructor', 'first_name last_name email')
      .exec();
    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }
    return alert;
  }

  async resolve(id: string): Promise<Alert> {
    return this.update(id, { resolved: true });
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid Alert ID: ${id}`);
    }
    const result = await this.alertModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }
  }

  async count(): Promise<number> {
    return this.alertModel.countDocuments().exec();
  }
}
