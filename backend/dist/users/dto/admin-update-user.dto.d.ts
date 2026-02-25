import { UserRole, UserStatus } from '../schemas/user.schema';
export declare class AdminUpdateUserDto {
    first_name?: string;
    last_name?: string;
    email?: string;
    role?: UserRole;
    status?: UserStatus;
    academic_level?: string;
    phone?: string;
    risk_level?: 'LOW' | 'MEDIUM' | 'HIGH';
    points_gamification?: number;
    password?: string;
}
