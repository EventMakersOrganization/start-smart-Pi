import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Activity,
  ActivityDocument,
  ActivityAction,
  ActivityChannel,
} from './schemas/activity.schema';

export interface LogActivityOptions {
  channel?: ActivityChannel;
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
  ) {}

  async logActivity(
    userId: string | Types.ObjectId,
    action: ActivityAction,
    options?: LogActivityOptions,
  ): Promise<void> {
    const activity = new this.activityModel({
      userId,
      action,
      channel: options?.channel ?? ActivityChannel.UNKNOWN,
    });
    await activity.save();
  }

  async getAllActivities() {
    return this.activityModel.find().populate('userId', 'name email').exec();
  }
}

/** Resolve channel from optional client hint header and User-Agent (login / tracking). */
export function classifyChannelFromHeaders(
  userAgent?: string,
  xClientChannel?: string,
): ActivityChannel {
  const hint = (xClientChannel || '').toLowerCase().trim();
  if (hint === 'web') {
    return ActivityChannel.WEB;
  }
  if (hint === 'mobile') {
    return ActivityChannel.MOBILE;
  }
  const ua = (userAgent || '').toLowerCase();
  if (/mobile|android|iphone|ipad|ipod|webos|blackberry/i.test(ua)) {
    return ActivityChannel.MOBILE;
  }
  if (ua.length > 0) {
    return ActivityChannel.WEB;
  }
  return ActivityChannel.UNKNOWN;
}
