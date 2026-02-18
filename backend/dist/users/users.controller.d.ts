import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(req: any): Promise<{
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
    updateProfile(req: any, updateProfileDto: UpdateProfileDto): Promise<{
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
