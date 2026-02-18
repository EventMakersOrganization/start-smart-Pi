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
    validateUser(email: string, password: string): Promise<any>;
    login(user: any): Promise<{
        token: string;
        user: {
            id: any;
            name: any;
            role: any;
        };
    }>;
}
