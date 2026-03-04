import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRole } from './schemas/user.schema';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    count(): Promise<number>;
    getProfile(req: any): Promise<{
        user: {
            id: any;
            first_name: string;
            last_name: string;
            email: string;
            phone: string;
            role: UserRole;
            status: import("./schemas/user.schema").UserStatus;
            avatar: string;
        };
        profile: {
            academic_level: string;
            risk_level: "LOW" | "MEDIUM" | "HIGH";
            points_gamification: number;
        };
    }>;
    updateProfile(req: any, updateProfileDto: UpdateProfileDto): Promise<{
        user: {
            id: any;
            first_name: string;
            last_name: string;
            email: string;
            phone: string;
            role: UserRole;
            status: import("./schemas/user.schema").UserStatus;
            avatar: string;
        };
        profile: {
            academic_level: string;
            risk_level: "LOW" | "MEDIUM" | "HIGH";
            points_gamification: number;
        };
    }>;
    uploadAvatar(userId: string, req: any, file: Express.Multer.File): Promise<{
        id: any;
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
        role: UserRole;
        status: import("./schemas/user.schema").UserStatus;
        avatar: string;
    }>;
}
