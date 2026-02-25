import { UserRole, UserStatus } from '../schemas/user.schema';
export declare class AdminCreateUserDto {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    role?: UserRole;
    status?: UserStatus;
    password?: string;
}
