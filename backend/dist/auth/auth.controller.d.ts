import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(createUserDto: CreateUserDto): Promise<{
        message: string;
    }>;
    login(req: any): Promise<{
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
    googleLogin(idToken: string): Promise<{
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
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
}
