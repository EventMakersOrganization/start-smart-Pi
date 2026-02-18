import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
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
            name: any;
            role: any;
        };
    }>;
}
