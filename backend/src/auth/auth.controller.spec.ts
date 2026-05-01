import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('AuthController', () => {
    let controller: AuthController;
    let service: AuthService;

    const mockAuthService = {
        register: jest.fn(),
        login: jest.fn(),
        loginWithGoogle: jest.fn(),
        forgotPassword: jest.fn(),
        resetPassword: jest.fn(),
        logout: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
            ],
        })
            .overrideGuard(LocalAuthGuard).useValue({ canActivate: () => true })
            .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
            .compile();

        controller = module.get<AuthController>(AuthController);
        service = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('register', () => {
        it('should call service.register (happy path)', async () => {
            const dto = { email: 'test@test.com' } as any;
            mockAuthService.register.mockResolvedValue({ message: 'OK' });

            const result = await controller.register(dto);

            expect(result).toEqual({ message: 'OK' });
            expect(service.register).toHaveBeenCalledWith(dto);
        });
    });

    describe('login', () => {
        it('should call service.login with request user (happy path)', async () => {
            const req = { user: { id: 'u1' } };
            mockAuthService.login.mockResolvedValue({ token: 'tok' });

            const result = await controller.login(req);

            expect(result).toEqual({ token: 'tok' });
            expect(service.login).toHaveBeenCalledWith(req.user, req);
        });
    });

    describe('googleLogin', () => {
        it('should call service.loginWithGoogle (happy path)', async () => {
            const idToken = 'google-token';
            mockAuthService.loginWithGoogle.mockResolvedValue({ token: 'tok' });

            const result = await controller.googleLogin(idToken);

            expect(result).toEqual({ token: 'tok' });
            expect(service.loginWithGoogle).toHaveBeenCalledWith(idToken);
        });
    });

    describe('forgotPassword', () => {
        it('should call service.forgotPassword (happy path)', async () => {
            const dto = { email: 'test@test.com' };
            mockAuthService.forgotPassword.mockResolvedValue({ message: 'Sent' });

            const result = await controller.forgotPassword(dto);

            expect(result).toEqual({ message: 'Sent' });
            expect(service.forgotPassword).toHaveBeenCalledWith(dto.email);
        });
    });

    describe('logout', () => {
        it('should call service.logout (happy path)', async () => {
            const req = { user: { id: 'u1' } };
            mockAuthService.logout.mockResolvedValue({ message: 'Logged out' });

            const result = await controller.logout(req);

            expect(result).toEqual({ message: 'Logged out' });
            expect(service.logout).toHaveBeenCalledWith(req.user);
        });
    });
});
