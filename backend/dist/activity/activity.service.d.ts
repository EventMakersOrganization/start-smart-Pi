import { Model } from 'mongoose';
import { Activity, ActivityDocument, ActivityAction } from './schemas/activity.schema';
export declare class ActivityService {
    private activityModel;
    constructor(activityModel: Model<ActivityDocument>);
    logActivity(userId: string, action: ActivityAction): Promise<void>;
    getAllActivities(): Promise<Omit<import("mongoose").Document<unknown, {}, ActivityDocument> & Activity & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }, never>[]>;
}
