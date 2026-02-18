import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Activity, ActivityDocument, ActivityAction } from './schemas/activity.schema';

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
  ) {}

  async logActivity(userId: string, action: ActivityAction): Promise<void> {
    const activity = new this.activityModel({
      userId,
      action,
    });
    await activity.save();
  }

  async getAllActivities() {
    return this.activityModel.find().populate('userId', 'name email').exec();
  }
}
