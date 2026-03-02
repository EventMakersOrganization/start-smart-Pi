import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(req: any): Promise<{
        user: {
            id: any;
            first_name: string;
            last_name: string;
            email: string;
            phone: string;
            role: import("./schemas/user.schema").UserRole;
            status: import("./schemas/user.schema").UserStatus;
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
            role: import("./schemas/user.schema").UserRole;
            status: import("./schemas/user.schema").UserStatus;
        };
        profile: {
            academic_level: string;
            risk_level: "LOW" | "MEDIUM" | "HIGH";
            points_gamification: number;
        };
    }>;
}
