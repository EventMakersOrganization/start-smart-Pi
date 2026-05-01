import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument, UserRole, UserStatus } from "../users/schemas/user.schema";
import { ActivityAction, ActivityChannel } from "./schemas/activity.schema";
import { UserSession, UserSessionDocument } from "./schemas/user-session.schema";

const SESSION_TIMEOUT_MINUTES = 15;

@Injectable()
export class SessionService {
  constructor(
    @InjectModel(UserSession.name)
    private readonly sessionModel: Model<UserSessionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async touchSession(
    userId: string | Types.ObjectId,
    options?: {
      channel?: ActivityChannel;
      action?: ActivityAction;
      at?: Date;
    },
  ): Promise<void> {
    const normalizedUserId = this.toObjectId(userId);
    const seenAt = options?.at ?? new Date();
    const action = options?.action ?? ActivityAction.PAGE_VIEW;
    const channel = options?.channel ?? ActivityChannel.UNKNOWN;

    const currentSession = await this.sessionModel
      .findOne({ userId: normalizedUserId, isOnline: true })
      .sort({ lastSeenAt: -1, _id: -1 })
      .exec();

    if (currentSession) {
      currentSession.lastSeenAt = seenAt;
      currentSession.lastActivityAt = seenAt;
      currentSession.lastActivityAction = action;
      currentSession.channel = channel;
      currentSession.endedAt = null;
      await currentSession.save();
      return;
    }

    await this.sessionModel.create({
      userId: normalizedUserId,
      startedAt: seenAt,
      lastSeenAt: seenAt,
      lastActivityAt: seenAt,
      lastActivityAction: action,
      channel,
      isOnline: true,
      endedAt: null,
    });
  }

  async markSessionEnded(userId: string | Types.ObjectId, endedAt = new Date()): Promise<void> {
    const normalizedUserId = this.toObjectId(userId);
    await this.sessionModel
      .updateMany(
        { userId: normalizedUserId, isOnline: true },
        { $set: { isOnline: false, endedAt } },
      )
      .exec();
  }

  async closeExpiredSessions(now = new Date()): Promise<number> {
    const timeoutThreshold = new Date(now.getTime() - SESSION_TIMEOUT_MINUTES * 60 * 1000);
    const result = await this.sessionModel
      .updateMany(
        {
          isOnline: true,
          lastSeenAt: { $lt: timeoutThreshold },
        },
        { $set: { isOnline: false, endedAt: now } },
      )
      .exec();
    return Number(result.modifiedCount || 0);
  }

  async countOnlineUsers(scope: "students" | "allUsers"): Promise<number> {
    await this.closeExpiredSessions();
    const activeSessionUserIds = await this.sessionModel.distinct("userId", {
      isOnline: true,
      endedAt: null,
    });
    return this.filterByScopeCount(activeSessionUserIds, scope);
  }

  async countUsersSeenInWindow(
    from: Date,
    to: Date,
    scope: "students" | "allUsers",
  ): Promise<number> {
    const sessionUserIds = await this.sessionModel.distinct("userId", {
      lastSeenAt: { $gte: from, $lte: to },
    });
    return this.filterByScopeCount(sessionUserIds, scope);
  }

  async getOnlineUserIdSet(scope: "students" | "allUsers"): Promise<Set<string>> {
    await this.closeExpiredSessions();
    const activeSessionUserIds = await this.sessionModel.distinct("userId", {
      isOnline: true,
      endedAt: null,
    });
    const ids = await this.filterByScopeIds(activeSessionUserIds, scope);
    return new Set(ids);
  }

  private async filterByScopeCount(
    rawUserIds: Array<string | Types.ObjectId>,
    scope: "students" | "allUsers",
  ): Promise<number> {
    const ids = await this.filterByScopeIds(rawUserIds, scope);
    return ids.length;
  }

  private async filterByScopeIds(
    rawUserIds: Array<string | Types.ObjectId>,
    scope: "students" | "allUsers",
  ): Promise<string[]> {
    const objectIds = rawUserIds
      .map((id) => String(id))
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (objectIds.length === 0) {
      return [];
    }

    const filter =
      scope === "students"
        ? { _id: { $in: objectIds }, role: UserRole.STUDENT, status: UserStatus.ACTIVE }
        : { _id: { $in: objectIds } };

    const users = await this.userModel.find(filter).select("_id").lean<UserDocument[]>().exec();
    return users.map((user: any) => String(user._id));
  }

  private toObjectId(userId: string | Types.ObjectId): Types.ObjectId {
    const value = String(userId);
    if (Types.ObjectId.isValid(value)) {
      return new Types.ObjectId(value);
    }
    throw new Error(`Invalid user id for session tracking: ${value}`);
  }
}
