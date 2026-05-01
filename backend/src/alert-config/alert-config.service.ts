import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AlertConfig, AlertConfigDocument } from './alert-config.schema';

export interface AlertThresholdValues {
  lowThreshold: number;
  mediumThreshold: number;
  highThreshold: number;
}

@Injectable()
export class AlertConfigService {
  constructor(
    @InjectModel(AlertConfig.name)
    private alertConfigModel: Model<AlertConfigDocument>,
  ) {}

  async getConfig(): Promise<AlertConfigDocument> {
    let config = await this.alertConfigModel.findOne().exec();

    if (!config) {
      config = new this.alertConfigModel({
        lowThreshold: 30,
        mediumThreshold: 70,
        highThreshold: 71,
      });
      await config.save();
    }

    return config;
  }

  async updateConfig(update: AlertThresholdValues): Promise<AlertConfigDocument> {
    this.validateThresholds(update);

    const config = await this.getConfig();

    config.lowThreshold = update.lowThreshold;
    config.mediumThreshold = update.mediumThreshold;
    config.highThreshold = update.highThreshold;

    return config.save();
  }

  private validateThresholds(update: AlertThresholdValues): void {
    const { lowThreshold, mediumThreshold, highThreshold } = update;

    if (lowThreshold < 0 || mediumThreshold < 0 || highThreshold < 0) {
      throw new BadRequestException('Thresholds cannot be negative.');
    }

    if (lowThreshold > 100 || mediumThreshold > 100 || highThreshold > 100) {
      throw new BadRequestException('Thresholds cannot exceed 100.');
    }

    if (!(lowThreshold <= mediumThreshold && mediumThreshold < highThreshold)) {
      throw new BadRequestException(
        'Threshold ordering must satisfy: lowThreshold <= mediumThreshold < highThreshold.',
      );
    }
  }
}
