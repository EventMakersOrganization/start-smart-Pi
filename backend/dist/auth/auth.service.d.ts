import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { UserDocument } from '../users/schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { ActivityService } from '../activity/activity.service';
export declare class AuthService {
    private userModel;
    private jwtService;
    private activityService;
    constructor(userModel: Model<UserDocument>, jwtService: JwtService, activityService: ActivityService);
    register(createUserDto: CreateUserDto): Promise<{
        message: string;
    }>;
    private sendWelcomeEmail;
    loginWithGoogle(idToken: string): Promise<{
        token: string;
        user: {
            id: any;
            first_name: any;
            last_name: any;
            name: string;
            email: any;
            role: any;
        };
    }>;
    validateUser(email: string, password: string): Promise<any>;
    login(user: any): Promise<{
        token: string;
        user: {
            id: any;
            first_name: any;
            last_name: any;
            name: string;
            email: any;
            role: any;
        };
    }>;
    forgotPassword(email: string): Promise<{
        message: string;
    }>;
    resetPassword(token: string, newPassword: string): Promise<{
        message: string;
    }>;
}
