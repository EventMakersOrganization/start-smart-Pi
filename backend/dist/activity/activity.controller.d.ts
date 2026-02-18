import { ActivityService } from './activity.service';
export declare class ActivityController {
    private readonly activityService;
    constructor(activityService: ActivityService);
    getActivities(): Promise<Omit<import("mongoose").Document<unknown, {}, import("./schemas/activity.schema").ActivityDocument> & import("./schemas/activity.schema").Activity & import("mongoose").Document<any, any, any> & {
        _id: import("mongoose").Types.ObjectId;
    }, never>[]>;
}
