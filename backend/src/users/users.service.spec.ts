import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { User, UserRole, UserStatus } from './schemas/user.schema';
import { StudentProfile } from './schemas/student-profile.schema';
import { ActivityService } from '../activity/activity.service';
import { SessionService } from '../activity/session.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('UsersService', () => {
    let service: UsersService;
    let userModel: any;
    let profileModel: any;
    let activityService: any;
    let sessionService: any;

    const mockUser = {
        _id: new Types.ObjectId().toHexString(),
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '12345678',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        save: jest.fn().mockResolvedValue(true),
    };

    const mockProfile = {
        userId: mockUser._id,
        class: 'Grade 10',
        risk_level: 'low',
        points_gamification: 100,
    };

    beforeEach(async () => {
        // A mock class to simulate Mongoose Model behavior (constructor + static methods)
        class MockUserModel {
            constructor(public data: any) {
                Object.assign(this, data);
            }
            static findById = jest.fn();
            static findOne = jest.fn();
            static find = jest.fn();
            static deleteOne = jest.fn();
            save = jest.fn().mockResolvedValue(this);
        }

        class MockProfileModel {
            constructor(public data: any) {
                Object.assign(this, data);
            }
            static findOne = jest.fn();
            static find = jest.fn();
            static findOneAndUpdate = jest.fn();
            static deleteOne = jest.fn();
            save = jest.fn().mockResolvedValue(this);
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: getModelToken(User.name),
                    useValue: MockUserModel,
                },
                {
                    provide: getModelToken(StudentProfile.name),
                    useValue: MockProfileModel,
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
                        getOnlineUserIdSet: jest.fn().mockResolvedValue(new Set()),
                    },
                },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
        userModel = module.get(getModelToken(User.name));
        profileModel = module.get(getModelToken(StudentProfile.name));
        activityService = module.get(ActivityService);
        sessionService = module.get(SessionService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getProfile', () => {
        it('should return user profile when user exists (happy path)', async () => {
            userModel.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUser),
            });
            profileModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockProfile),
            });

            const result = await service.getProfile(mockUser._id);

            expect(result.user.email).toBe(mockUser.email);
            expect(result.profile.class).toBe(mockProfile.class);
        });

        it('should throw NotFoundException when user does not exist (error path)', async () => {
            userModel.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(null),
            });

            await expect(service.getProfile('invalidId')).rejects.toThrow(NotFoundException);
        });

        it('should return profile as null if student profile is missing (edge case)', async () => {
            userModel.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUser),
            });
            profileModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const result = await service.getProfile(mockUser._id);
            expect(result.profile).toBeNull();
        });
    });

    describe('updateProfile', () => {
        it('should update user and profile (happy path)', async () => {
            const updateDto = { first_name: 'Updated', class: 'Grade 11' };
            const updatedUser = { ...mockUser, first_name: 'Updated', save: jest.fn() };

            userModel.findById.mockResolvedValue(updatedUser);
            profileModel.findOneAndUpdate.mockReturnValue({
                exec: jest.fn().mockResolvedValue(true),
            });

            // Mock the subsequent getProfile call
            jest.spyOn(service, 'getProfile').mockResolvedValue({
                user: { ...mockUser, first_name: 'Updated' } as any,
                profile: { ...mockProfile, class: 'Grade 11' } as any
            });

            const result = await service.updateProfile(mockUser._id, updateDto);

            expect(updatedUser.first_name).toBe('Updated');
            expect(updatedUser.save).toHaveBeenCalled();
            expect(activityService.logActivity).toHaveBeenCalled();
            expect(result.user.first_name).toBe('Updated');
        });

        it('should throw NotFoundException if user to update does not exist (error path)', async () => {
            userModel.findById.mockResolvedValue(null);
            await expect(service.updateProfile('invalidId', {})).rejects.toThrow(NotFoundException);
        });
    });

    describe('createUserByAdmin', () => {
        it('should create a new user (happy path)', async () => {
            const dto = {
                first_name: 'Admin',
                last_name: 'User',
                email: 'admin_test@example.com',
                phone: '123456',
                role: UserRole.STUDENT,
                password: 'password123'
            };

            userModel.findOne.mockResolvedValue(null); // No existing user

            const result = await service.createUserByAdmin(dto);

            expect(result.message).toBe('User created successfully');
            expect(result.user.email).toBe(dto.email);
            expect(userModel.findOne).toHaveBeenCalledWith({ email: dto.email });
        });

        it('should throw ConflictException if email exists (error path)', async () => {
            userModel.findOne.mockResolvedValue(mockUser);
            await expect(service.createUserByAdmin({ email: mockUser.email } as any)).rejects.toThrow(ConflictException);
        });

        it('should generate a random password if none provided (edge case)', async () => {
            const dto = {
                first_name: 'NoPass',
                email: 'nopass@example.com',
            };

            userModel.findOne.mockResolvedValue(null);

            const result = await service.createUserByAdmin(dto as any);
            expect(result.user.email).toBe(dto.email);
        });
    });
});
