import { UserRole } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AdminUpdateUserDto } from '../users/dto/admin-update-user.dto';
import { AdminCreateUserDto } from '../users/dto/admin-create-user.dto';
export declare class AdminController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getStudents(): Promise<any[]>;
    getInstructors(): Promise<any[]>;
    updateUser(id: string, dto: AdminUpdateUserDto): Promise<{
        success: boolean;
    }>;
    deleteUser(id: string): Promise<{
        success: boolean;
    }>;
    createUser(dto: AdminCreateUserDto): Promise<{
        message: string;
        user: {
            id: any;
            first_name: string;
            last_name: string;
            email: string;
            phone: string;
            role: UserRole;
            status: import("../users/schemas/user.schema").UserStatus;
        };
    }>;
}
