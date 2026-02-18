import { Model } from 'mongoose';
import { UserDocument } from './schemas/user.schema';
import { StudentProfileDocument } from './schemas/student-profile.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ActivityService } from '../activity/activity.service';
export declare class UsersService {
    private userModel;
    private profileModel;
    private activityService;
    constructor(userModel: Model<UserDocument>, profileModel: Model<StudentProfileDocument>, activityService: ActivityService);
    getProfile(userId: string): Promise<{
        user: {
            id: any;
            name: string;
            email: string;
            role: import("./schemas/user.schema").UserRole;
            status: import("./schemas/user.schema").UserStatus;
        };
        profile: {
            academicLevel: string;
            enrolledCourse: string;
            preferences: Record<string, any>;
            averageScore: number;
        };
    }>;
    updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<{
        user: {
            id: any;
            name: string;
            email: string;
            role: import("./schemas/user.schema").UserRole;
            status: import("./schemas/user.schema").UserStatus;
        };
        profile: {
            academicLevel: string;
            enrolledCourse: string;
            preferences: Record<string, any>;
            averageScore: number;
        };
    }>;
}
