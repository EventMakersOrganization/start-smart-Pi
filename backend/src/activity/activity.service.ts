import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Activity,
  ActivityDocument,
  ActivityAction,
  ActivityChannel,
} from "./schemas/activity.schema";
import { SessionService } from "./session.service";

export interface LogActivityOptions {
  channel?: ActivityChannel;
  pagePath?: string;
  resourceType?: string;
  resourceId?: string;
  resourceTitle?: string;
  durationSec?: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
    private readonly sessionService: SessionService,
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
      pagePath: options?.pagePath,
      resourceType: options?.resourceType,
      resourceId: options?.resourceId,
      resourceTitle: options?.resourceTitle,
      durationSec: options?.durationSec,
      metadata: options?.metadata || {},
    });
    await activity.save();
    await this.sessionService.touchSession(userId, {
      action,
      channel: options?.channel ?? ActivityChannel.UNKNOWN,
      at: new Date(),
    });
  }

  async getAllActivities() {
    return this.activityModel.find().populate("userId", "name email").exec();
  }

  async getUserActivities(
    userId: string | Types.ObjectId,
    options?: {
      limit?: number;
      action?: ActivityAction;
      resourceType?: string;
    },
  ) {
    const limit = Math.max(1, Math.min(Number(options?.limit || 200), 2000));
    const query: Record<string, any> = {
      userId: new Types.ObjectId(String(userId)),
    };

    if (options?.action) {
      query.action = options.action;
    }
    if (options?.resourceType) {
      query.resourceType = options.resourceType;
    }

    return this.activityModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
      .exec();
  }
}

/** Resolve channel from optional client hint header and User-Agent (login / tracking). */
export function classifyChannelFromHeaders(
  userAgent?: string,
  xClientChannel?: string,
): ActivityChannel {
  const hint = (xClientChannel || "").toLowerCase().trim();
  if (hint === "web") {
    return ActivityChannel.WEB;
  }
  if (hint === "mobile") {
    return ActivityChannel.MOBILE;
  }
  const ua = (userAgent || "").toLowerCase();
  if (/mobile|android|iphone|ipad|ipod|webos|blackberry/i.test(ua)) {
    return ActivityChannel.MOBILE;
  }
  if (ua.length > 0) {
    return ActivityChannel.WEB;
  }
  return ActivityChannel.UNKNOWN;
}
