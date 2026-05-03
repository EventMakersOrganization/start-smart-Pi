import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ActivityService } from '../activity/activity.service';
import { SessionService } from '../activity/session.service';
import { User, UserRole } from '../users/schemas/user.schema';
import { ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
    hash: jest.fn(),
    compare: jest.fn(),
}));

describe('AuthService', () => {
    let service: AuthService;
    let userModel: any;
    let jwtService: any;
    let activityService: any;

    const mockUser = {
        _id: 'userId123',
        email: 'test@example.com',
        password: 'hashedPassword',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.STUDENT,
        toObject: jest.fn().mockReturnThis(),
    };

    beforeEach(async () => {
        class MockUserModel {
            constructor(public data: any) {
                Object.assign(this, data);
            }
            static findOne = jest.fn();
            save = jest.fn().mockResolvedValue(this);
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: getModelToken(User.name),
                    useValue: MockUserModel,
                },
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn().mockReturnValue('mockToken'),
                    },
                },
                {
                    provide: ActivityService,
                    useValue: {
                        logActivity: jest.fn().mockResolvedValue(null),
                    },
                },
                {
                    provide: SessionService,
                    useValue: {
                        markSessionEnded: jest.fn().mockResolvedValue(null),
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        userModel = module.get(getModelToken(User.name));
        jwtService = module.get(JwtService);
        activityService = module.get(ActivityService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('register', () => {
        it('should register a new user (happy path)', async () => {
            const dto = {
                email: 'new@test.com',
                password: 'password123',
                first_name: 'New',
                last_name: 'User',
            };

            userModel.findOne.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

            const result = await service.register(dto);

            expect(result.message).toBe('User registered successfully');
            expect(userModel.findOne).toHaveBeenCalledWith({ email: dto.email });
        });

        it('should throw ConflictException if email exists (error path)', async () => {
            userModel.findOne.mockResolvedValue(mockUser);
            await expect(service.register({ email: mockUser.email } as any)).rejects.toThrow(ConflictException);
        });
    });

    describe('validateUser', () => {
        it('should return user info without password on valid credentials (happy path)', async () => {
            userModel.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUser),
            });
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const result = await service.validateUser('test@example.com', 'password123');

            expect(result).toBeDefined();
            expect(result.email).toBe(mockUser.email);
            expect(result.password).toBeUndefined();
        });

        it('should return null on invalid password (error path)', async () => {
            userModel.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUser),
            });
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            const result = await service.validateUser('test@example.com', 'wrong');
            expect(result).toBeNull();
        });
    });

    describe('login', () => {
        it('should return jwt token and user info (happy path)', async () => {
            const result = await service.login(mockUser);

            expect(result.token).toBe('mockToken');
            expect(result.user.email).toBe(mockUser.email);
            expect(activityService.logActivity).toHaveBeenCalled();
        });
    });

    describe('resetPassword', () => {
        it('should throw BadRequestException for invalid/expired token (error path)', async () => {
            userModel.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(null),
            });

            await expect(service.resetPassword('invalidToken', 'newPass')).rejects.toThrow(BadRequestException);
        });
    });
});
