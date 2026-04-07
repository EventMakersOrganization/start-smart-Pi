import { Model } from 'mongoose';
import { UserDocument, UserRole, UserStatus } from './schemas/user.schema';
import { StudentProfileDocument } from './schemas/student-profile.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ActivityService } from '../activity/activity.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
export declare class UsersService {
    private userModel;
    private profileModel;
    private activityService;
    constructor(userModel: Model<UserDocument>, profileModel: Model<StudentProfileDocument>, activityService: ActivityService);
    private profileLookupFilter;
    getProfile(userId: string): Promise<{
        user: {
            id: any;
            first_name: string;
            last_name: string;
            email: string;
            phone: string;
            role: UserRole;
            status: UserStatus;
        };
        profile: {
            academic_level: string;
            risk_level: "LOW" | "MEDIUM" | "HIGH";
            points_gamification: number;
        };
    }>;
    updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<{
        user: {
            id: any;
            first_name: string;
            last_name: string;
            email: string;
            phone: string;
            role: UserRole;
            status: UserStatus;
        };
        profile: {
            academic_level: string;
            risk_level: "LOW" | "MEDIUM" | "HIGH";
            points_gamification: number;
        };
    }>;
    getUsersByRole(role: string): Promise<any[]>;
    listAllUsersForAdmin(): Promise<any[]>;
    updateUserById(id: string, dto: any): Promise<{
        success: boolean;
    }>;
    deleteUserById(id: string): Promise<{
        success: boolean;
    }>;
    createUserByAdmin(dto: AdminCreateUserDto): Promise<{
        message: string;
        user: {
            id: any;
            first_name: string;
            last_name: string;
            email: string;
            phone: string;
            role: UserRole;
            status: UserStatus;
        };
    }>;
}
